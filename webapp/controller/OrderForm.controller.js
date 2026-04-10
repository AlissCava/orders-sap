/**
 * Controller per la gestione del Form Ordini (Creazione e Modifica).
 * Gestisce la testata dell'ordine e una tabella di articoli in memoria locale
 * prima di inviare tutto al backend SAP tramite Deep Insert.
 */
sap.ui.define([
    "orders/controller/BaseController", // Controller genitore con funzioni utility
    "sap/ui/model/json/JSONModel",      // Modelli client-side per la UI
    "sap/m/MessageBox",                 // Popup per messaggi critici
    "sap/m/MessageToast",               // Messaggio a scomparsa per conferme
    "sap/ui/model/Filter",              // Costruttore per i filtri OData
    "sap/ui/model/FilterOperator",      // Operatori logici (EQ, NE, etc.)
    "sap/ui/core/Fragment"              // Caricamento asincrono di componenti XML (Dialog)
], function (BaseController, JSONModel, MessageBox, MessageToast, Filter, FilterOperator, Fragment) {
    "use strict";

    return BaseController.extend("orders.controller.OrderForm", {

        // ========================================================================
        // 1. CICLO DI VITA E NAVIGAZIONE
        // ========================================================================

        /**
         * Metodo eseguito una sola volta all'istanza del controller.
         */
        onInit: function () {
            // Ottiene il router e si registra all'evento "patternMatched" della route specifica.
            // Questo permette di eseguire logica ogni volta che l'utente atterra su questa pagina.
            this.getRouter().getRoute("RouteOrderForm").attachPatternMatched(this._onRouteMatched, this);
        },

        /**
         * Gestore dell'evento di navigazione verso questa vista.
         * @param {sap.ui.base.Event} oEvent L'evento di routing che contiene i parametri dell'URL.
         */
        _onRouteMatched: function (oEvent) {
            // Estrae l'ID dell'ordine (o la stringa "new") dai parametri definiti nel manifest.json
            const sObjectId = oEvent.getParameter("arguments").objectId;
            // Verifica se siamo in modalità creazione o visualizzazione/modifica
            const bIsNew = (sObjectId === "new");
            
            // Crea un modello JSON per gestire lo stato della UI (titoli, visibilità, etc.)
            const oViewModel = new JSONModel({
                isNew: bIsNew,
                // Calcola il titolo della pagina: usa i18n per supportare più lingue
                viewTitle: bIsNew ? this.getText("btnNewOrder") : this.getText("lblOrderNo") + " " + sObjectId
            });
            // Assegna il modello alla vista con il nome "viewModel"
            this.setModel(oViewModel, "viewModel");

            if (bIsNew) {
                // Se è un nuovo ordine, inizializza un oggetto vuoto nel modello locale
                this._createEmptyForm(); 
            } else {
                // Se è un ordine esistente, chiama il backend per recuperare i dati
                this._loadOrderData(sObjectId); 
            }
        },

        // ========================================================================
        // 2. LOGICA DATI E COMUNICAZIONE ODATA (BACKEND)
        // ========================================================================

        /**
         * Crea una struttura dati vuota per il modello del form.
         */
        _createEmptyForm: function () {
            const oEmptyOrder = {
                NumOrdine: "Auto-generated", // Testo segnaposto prima del salvataggio
                Cliente: "",
                StatoTxt: "Nuovo", 
                ImportoTot: 0,
                Articoli: [] // Inizialmente l'array degli articoli è vuoto
            };

            const oFormModel = new JSONModel(oEmptyOrder);
            this.setModel(oFormModel, "formModel");
        },

        /**
         * Recupera i dati dal server SAP eseguendo due letture sequenziali.
         * @param {string} sOrderId ID dell'ordine da caricare.
         */
        _loadOrderData: function (sOrderId) {
            const oODataModel = this.getOwnerComponent().getModel(); // Ottiene il modello OData principale
            const that = this; // Salva il riferimento al controller per le callback
            
            sap.ui.core.BusyIndicator.show(0); // Blocca l'interfaccia con un caricamento
            const iOrderId = parseInt(sOrderId, 10);

            // Prima Lettura: Recupero i dati di Testata (Cliente, Stato, etc.)
            oODataModel.read("/ZES_lista_ordiniSet", {
                filters: [new Filter("NumOrdine", FilterOperator.EQ, iOrderId)],
                success: function (oHeaderResult) {
                    // Controllo di sicurezza se l'array dei risultati è vuoto
                    if (!oHeaderResult.results || oHeaderResult.results.length === 0) {
                        sap.ui.core.BusyIndicator.hide();
                        MessageBox.error(that.getText("msgErrorBackend"));
                        that.onNavBack();
                        return;
                    }

                    // Prepara l'oggetto finale partendo dai dati della testata
                    const oHeaderData = oHeaderResult.results[0];
                    const oOrderData = {
                        NumOrdine: oHeaderData.NumOrdine,
                        Cliente: oHeaderData.Cliente,
                        StatoTxt: oHeaderData.StatoTxt,
                        ImportoTot: oHeaderData.ImportoTot,
                        Articoli: [] // Sarà popolato dalla seconda chiamata
                    };

                    // Seconda Lettura: Recupero i Dettagli (Articoli) associati all'ordine
                    oODataModel.read("/ZES_dettagli_ordiniSet", {
                        filters: [new Filter("NumOrdine", FilterOperator.EQ, iOrderId)],
                        success: function (oItemsData) {
                            sap.ui.core.BusyIndicator.hide(); // Operazione conclusa
                            oOrderData.Articoli = oItemsData.results || [];
                            // Carica tutti i dati (Testata + Articoli) nel modello JSON dedicato al form
                            that.setModel(new JSONModel(oOrderData), "formModel");
                        },
                        error: function () {
                            sap.ui.core.BusyIndicator.hide();
                            MessageBox.warning("Articoli non caricati.");
                            // Carica comunque la testata anche se i dettagli falliscono
                            that.setModel(new JSONModel(oOrderData), "formModel");
                        }
                    });
                },
                error: function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    that.handleBackendError(oError); // Gestione errore centralizzata
                    that.onNavBack();
                }
            });
        },

        // ========================================================================
        // 3. GESTIONE DIALOG AGGIUNTA ARTICOLO (FRAGMENT)
        // ========================================================================
        
        /**
         * Apre il popup per l'inserimento di un nuovo articolo.
         */
        onAddArticleToOrder: function () {
            const oView = this.getView();

            // Verifica se il Fragment esiste già in memoria per non ricrearlo inutilmente (Performance)
            if (!this.byId("articleDialog")) {
                Fragment.load({
                    id: oView.getId(), // ID della vista per permettere l'uso di this.byId() dentro il fragment
                    name: "orders.view.AddArticleDialog", // Percorso del file XML del Fragment
                    controller: this // Collega le azioni del fragment a questo controller
                }).then(function (oDialog) {
                    // Collega il ciclo di vita del Dialog alla Vista (eredita modelli e traduzioni)
                    oView.addDependent(oDialog);
                    this._clearDialogFields();
                    oDialog.open();
                }.bind(this)); // .bind(this) assicura che all'interno della Promise 'this' sia il controller
            } else {
                // Se esiste già, resetta i campi e lo apre direttamente
                this._clearDialogFields();
                this.byId("articleDialog").open();
            }
        },

        /**
         * Pulisce i valori degli input nella Dialog.
         */
        _clearDialogFields: function () {
            this.byId("inputDialogCode").setValue("");
            this.byId("inputDialogQty").setValue("1");
            this.byId("inputDialogName").setValue("");
            this.byId("inputDialogPrice").setValue("");
        },

        /**
         * Conferma l'aggiunta dell'articolo alla tabella locale.
         */
        onConfirmAddArticle: function () {
            // Recupero valori dai campi di input tramite ID
            const sCode = this.byId("inputDialogCode").getValue();
            const sQty = this.byId("inputDialogQty").getValue();
            const sName = this.byId("inputDialogName").getValue();
            const sPrice = this.byId("inputDialogPrice").getValue();

            // Validazione minima obbligatorietà
            if (!sCode || !sQty) {
                MessageBox.warning(this.getText("msgErrorFieldsEmpty"));
                return;
            }

            // Crea l'oggetto articolo convertendo le stringhe della UI nei tipi corretti
            const oNewRow = {
                CodArticolo: parseInt(sCode, 10),
                NomeArticolo: sName || "Articolo Sconosciuto",
                QuantitaOrdine: parseInt(sQty, 10),
                Importo: parseFloat(sPrice) || 0
            };

            const oFormModel = this.getModel("formModel");
            const aArticles = oFormModel.getProperty("/Articoli"); // Ottiene l'array corrente
            
            aArticles.push(oNewRow); // Aggiunge il nuovo elemento all'array
            
            // Aggiorna la proprietà nel modello per triggerare il refresh della tabella UI
            oFormModel.setProperty("/Articoli", aArticles);

            // Aggiorna il totale dell'ordine
            this._recalculateTotal(oFormModel);

            // Chiude il popup
            this.byId("articleDialog").close();
        },

        /**
         * Chiude la Dialog senza salvare nulla.
         */
        onCancelAddArticle: function () {
            this.byId("articleDialog").close();
        },

        /**
         * Ricalcola la somma totale basandosi sugli articoli presenti nel formModel.
         * @param {sap.ui.model.json.JSONModel} oFormModel Il modello da aggiornare.
         */
        _recalculateTotal: function(oFormModel) {
            const aArticles = oFormModel.getProperty("/Articoli");
            let fTotal = 0;
            
            // Itera su ogni riga e somma il prodotto Quantità * Prezzo
            aArticles.forEach(function(item) {
                const iQty = parseInt(item.QuantitaOrdine) || 1;
                const fPrice = parseFloat(item.Importo) || 0;
                fTotal += (iQty * fPrice);
            });
            
            // Formatta a 2 decimali e salva nel modello
            oFormModel.setProperty("/ImportoTot", fTotal.toFixed(2));
        },

        // ========================================================================
        // 4. SALVATAGGIO FINALE (DEEP INSERT)
        // ========================================================================

        /**
         * Prepara il payload complesso e invia tutto a SAP in un'unica transazione.
         */
        onSave: function () {
            const oFormModel = this.getModel("formModel");
            const oViewModel = this.getModel("viewModel");
            const that = this;

            const oFormData = oFormModel.getData();
            const bIsNew = oViewModel.getProperty("/isNew");

            // Controllo validità testata
            if (!oFormData.Cliente || oFormData.Cliente.trim() === "") {
                MessageBox.error(this.getText("msgErrorFieldsEmpty"));
                return;
            }

            // 1. Preparazione Articoli per SAP (Mapping dei tipi dati corretti)
            const aItemsSap = [];
            let fTotalAmount = 0;

            if (oFormData.Articoli && oFormData.Articoli.length > 0) {
                oFormData.Articoli.forEach(function(item) {
                    const iQty = parseInt(item.QuantitaOrdine, 10) || 1;
                    const fPrice = parseFloat(item.Importo) || 0;
                    
                    aItemsSap.push({
                        "CodArticolo": parseInt(item.CodArticolo, 10) || 0,
                        "NomeArticolo": item.NomeArticolo || "",
                        "QuantitaOrdine": iQty,
                        "Importo": fPrice
                    });
                    
                    fTotalAmount += (iQty * fPrice);
                });
            }

            // 2. Mapping dello Stato (Converte le descrizioni UI in codici DB)
            let iStato = 1; 
            if (oFormData.StatoTxt === "In Lavorazione") iStato = 2;
            if (oFormData.StatoTxt === "Completato") iStato = 3;

            // 3. Costruzione del Deep Payload (La struttura deve riflettere l'EDM di SAP)
            const sOperation = bIsNew ? "C" : "U"; 
            const iNumOrdine = bIsNew ? 0 : parseInt(oFormData.NumOrdine, 10);

            const oDeepPayload = {
                "Operation": sOperation, 
                "NumOrdine": iNumOrdine,
                
                // Entità Testata
                "ZET_lista_ordini": {
                    "NumOrdine": iNumOrdine,
                    "Cliente": oFormData.Cliente,
                    "DataOrdine": new Date(), 
                    "ImportoTot": fTotalAmount,
                    "Stato": iStato
                },
                
                // Navigation Property verso i dettagli (Deep Insert)
                "ZET_dettagli_ordiniSet": aItemsSap
            };

            sap.ui.core.BusyIndicator.show(0);

            // 4. DELEGHIAMO AL PADRE! Usiamo la Promise odataCreate per il Deep Insert
            this.odataCreate("/ZES_DeepOrdiniSet", oDeepPayload)
            .then(function () {
                sap.ui.core.BusyIndicator.hide();
                
                // 1. Messaggio fisso ultra-sicuro
                MessageToast.show("Ordine salvato con successo!"); 
                
                // 2. Aggiornamento del modello globale forzato
                if (that.getOwnerComponent().getModel()) {
                    that.getOwnerComponent().getModel().refresh(true); 
                }
                
                // 3. Navigazione manuale e sicura alla pagina precedente
                const oHistory = sap.ui.core.routing.History.getInstance();
                const sPreviousHash = oHistory.getPreviousHash();

                if (sPreviousHash !== undefined) {
                    // Se c'è una cronologia, simula il tasto "Indietro" del browser
                    window.history.go(-1);
                } else {
                    // Altrimenti naviga esplicitamente alla Home (controlla che si chiami "TargetHome" o "RouteHome" nel tuo manifest)
                    that.getRouter().navTo("TargetHome", {}, true); 
                }
            })
            
            .catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                that.handleBackendError(oError); 
            });
        },

        /**
         * Annulla l'operazione e torna indietro.
         */
        onCancel: function () {
            this.onNavBack();
        }
    });
});