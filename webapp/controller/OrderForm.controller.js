sap.ui.define([
    "orders/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (BaseController, JSONModel, MessageBox, MessageToast, Filter, FilterOperator) {
    "use strict";

    return BaseController.extend("orders.controller.OrderForm", {

        // ------------------------------------------------------------------------
        // 1. INIZIALIZZAZIONE E ROUTING
        // ------------------------------------------------------------------------
        onInit: function () {
            // Quando scatta "RouteOrderForm", chiama la funzione _onRouteMatched
            this.getRouter().getRoute("RouteOrderForm").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            // Leggiamo l'ID passato nell'URL (es: "new" oppure "4")
            const sObjectId = oEvent.getParameter("arguments").objectId;

            // Creiamo un modello (viewModel) per controllare l'interfaccia (es. Titolo pagina)
            const bIsNew = (sObjectId === "new");
            const oViewModel = new JSONModel({
                isNew: bIsNew,
                viewTitle: bIsNew ? "New Order" : "Edit Order " + sObjectId
            });
            this.setModel(oViewModel, "viewModel");

            // Decidiamo cosa fare con i dati in base all'ID
            if (bIsNew) {
                this._createEmptyForm(); // Modalità CREAZIONE
            } else {
                this._loadOrderData(sObjectId); // Modalità MODIFICA
            }
        },

        // ------------------------------------------------------------------------
        // 2. GESTIONE DATI (NUOVO vs ESISTENTE)
        // ------------------------------------------------------------------------
        _createEmptyForm: function () {
            // Prepariamo un "guscio vuoto" per il nuovo ordine
            // I nomi delle proprietà restano quelli del backend SAP per non rompere i collegamenti XML
            const oEmptyOrder = {
                NumOrdine: "Auto-generated", 
                Cliente: "",
                StatoTxt: "New",
                ImportoTot: 0,
                Articoli: [] // Tabella articoli inizialmente vuota
            };

            const oFormModel = new JSONModel(oEmptyOrder);
            this.setModel(oFormModel, "formModel");
        },

        _loadOrderData: function (sOrderId) {
            const oODataModel = this.getOwnerComponent().getModel(); 
            const that = this;

            sap.ui.core.BusyIndicator.show(0);

            // Per sicurezza, trasformiamo l'ID in numero puro per i filtri
            const iOrderId = parseInt(sOrderId, 10);

            // 1. PRIMA CHIAMATA: Leggiamo la testata usando un FILTRO (per aggirare il blocco "addressable=false")
            oODataModel.read("/ZES_lista_ordiniSet", {
                filters: [new Filter("NumOrdine", FilterOperator.EQ, iOrderId)],
                success: function (oHeaderResult) {
                    
                    // Siccome abbiamo chiesto una "lista" filtrata, il risultato è un array.
                    // Controlliamo che abbia trovato almeno un ordine e prendiamo il primo (e unico)
                    if (!oHeaderResult.results || oHeaderResult.results.length === 0) {
                        sap.ui.core.BusyIndicator.hide();
                        MessageBox.error("Order not found on server.");
                        return;
                    }

                    const oHeaderData = oHeaderResult.results[0];

                    // Trasformiamo i dati della testata per il nostro form
                    const oOrderData = {
                        NumOrdine: oHeaderData.NumOrdine,
                        Cliente: oHeaderData.Cliente,
                        StatoTxt: oHeaderData.StatoTxt,
                        ImportoTot: oHeaderData.ImportoTot,
                        Articoli: [] // Inizialmente vuoto
                    };

                    // 2. SECONDA CHIAMATA: Leggiamo gli Articoli di questo ordine con un altro filtro
                    oODataModel.read("/ZES_dettagli_ordiniSet", {
                        filters: [new Filter("NumOrdine", FilterOperator.EQ, iOrderId)],
                        success: function (oItemsData) {
                            sap.ui.core.BusyIndicator.hide();

                            // Aggiungiamo gli articoli recuperati ai dati dell'ordine
                            oOrderData.Articoli = oItemsData.results || [];

                            // Infine, passiamo tutto alla View
                            const oFormModel = new JSONModel(oOrderData);
                            that.setModel(oFormModel, "formModel");
                        },
                        error: function () {
                            sap.ui.core.BusyIndicator.hide();
                            MessageBox.warning("Order header loaded, but failed to load items.");
                            
                            // Mostriamo comunque la testata anche se gli articoli falliscono
                            const oFormModel = new JSONModel(oOrderData);
                            that.setModel(oFormModel, "formModel");
                        }
                    });

                },
                error: function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error("The server rejected the header request.");
                }
            });
        },

        // ------------------------------------------------------------------------
        // 3. AZIONI DELLA PAGINA (Aggiungi Riga, Salva, Annulla)
        // ------------------------------------------------------------------------
        
        // Funzione per il tasto "+" nella tabella articoli
        onAddArticleToOrder: function() {
            const oFormModel = this.getModel("formModel");
            const aArticles = oFormModel.getProperty("/Articoli");
            
            // Aggiungiamo una riga vuota all'array
            aArticles.push({
                CodArticolo: "",
                NomeArticolo: "",
                QuantitaOrdine: 1,
                Importo: 0
            });
            
            // Aggiorniamo il modello (la tabella si aggiornerà da sola!)
            oFormModel.setProperty("/Articoli", aArticles);
        },

        onSave: function () {
            const oFormModel = this.getModel("formModel");
            const oViewModel = this.getModel("viewModel");
            const oODataModel = this.getOwnerComponent().getModel();
            const that = this;

            const oFormData = oFormModel.getData();
            const bIsNew = oViewModel.getProperty("/isNew");

            // 1. Validazione di base
            if (!oFormData.Cliente || oFormData.Cliente.trim() === "") {
                MessageBox.error("Customer name is mandatory.");
                return;
            }

            // 2. Prepariamo l'array degli articoli ripulito per SAP
            // Assicuriamoci che i numeri siano numeri e non stringhe di testo
            const aItemsSap = [];
            let fTotalAmount = 0; // Ricalcoliamo il totale per sicurezza

            if (oFormData.Articoli && oFormData.Articoli.length > 0) {
                oFormData.Articoli.forEach(function(item) {
                    const iQty = parseInt(item.QuantitaOrdine) || 1;
                    const fPrice = parseFloat(item.Importo) || 0;
                    
                    aItemsSap.push({
                        "CodArticolo": parseInt(item.CodArticolo) || 0,
                        "NomeArticolo": item.NomeArticolo || "",
                        "QuantitaOrdine": iQty,
                        "Importo": fPrice
                    });
                    
                    fTotalAmount += (iQty * fPrice);
                });
            }

            // 3. Mappiamo lo Stato Testuale nel numero che vuole SAP
            let iStato = 1; // Default: Nuovo
            if (oFormData.StatoTxt === "In Lavorazione") iStato = 2;
            if (oFormData.StatoTxt === "Completato") iStato = 3;

            // 4. Costruiamo il PACCHETTO DEEP perfetto
            const sOperation = bIsNew ? "C" : "U";
            const iNumOrdine = bIsNew ? 0 : parseInt(oFormData.NumOrdine, 10);

            const oDeepPayload = {
                "Operation": sOperation, // La magia è tutta qui: 'C' per Nuovo, 'U' per Modifica
                "NumOrdine": iNumOrdine,
                
                "ZET_lista_ordini": {
                    "NumOrdine": iNumOrdine,
                    "Cliente": oFormData.Cliente,
                    "DataOrdine": new Date(), // Aggiorniamo la data a oggi
                    "ImportoTot": fTotalAmount,
                    "Stato": iStato
                },
                
                "ZET_dettagli_ordiniSet": aItemsSap
            };

            sap.ui.core.BusyIndicator.show(0);

            // 5. Invio al server SAP!
            oODataModel.create("/ZES_DeepOrdiniSet", oDeepPayload, {
                success: function () {
                    sap.ui.core.BusyIndicator.hide();
                    
                    // Mostriamo il messaggio giusto
                    MessageToast.show(bIsNew ? "Order successfully created!" : "Order successfully updated!");
                    
                    // Ricarichiamo il modello globale per aggiornare la tabella nella Home
                    oODataModel.refresh(true); 
                    
                    // Torniamo indietro alla Home
                    that.onNavBack(); 
                },
                error: function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    
                    // Cerchiamo di estrarre il messaggio di errore esatto di SAP
                    let sMsg = "Error during save.";
                    try {
                        const oErrorObj = JSON.parse(oError.responseText);
                        if (oErrorObj.error && oErrorObj.error.message) {
                            sMsg = oErrorObj.error.message.value;
                        }
                    } catch (e) {}
                    
                    MessageBox.error(sMsg);
                }
            });
        },

        onCancel: function () {
            // Torniamo semplicemente indietro senza salvare
            this.onNavBack();
        }
    });
});