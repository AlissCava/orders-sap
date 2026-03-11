sap.ui.define([
    "orders/controller/BaseController", // Il nostro controller con le funzioni condivise
    "sap/ui/export/Spreadsheet",        // Per scaricare l'Excel
    "sap/ui/model/Filter",              // Per creare regole di ricerca
    "sap/ui/model/FilterOperator",      // Operatori di ricerca (es. "Contiene")
    "sap/ui/model/json/JSONModel",      // Per creare modelli dati locali (popup e totali)
    "sap/m/MessageBox",                 // Per i popup di errore bloccanti
    "sap/m/MessageToast"                // Per i messaggini verdi a scomparsa
], function (BaseController, Spreadsheet, Filter, FilterOperator, JSONModel, MessageBox, MessageToast) {
    "use strict";

    return BaseController.extend("orders.controller.Home", {

        // ------------------------------------------------------------------------
        // 1. INIZIALIZZAZIONE DELLA PAGINA
        // ------------------------------------------------------------------------
        onInit: function () {
            // Modello 1: "formModel" - Serve per pulire e leggere i campi del popup "Nuovo Ordine"
            var oFormModel = new JSONModel({
                newOrder: {
                    CustomerName: "",
                    ArticleCode: "", 
                    ProductName: "",
                    Quantity: 1,
                    UnitPrice: 0
                }
            });
            this.setModel(oFormModel, "formModel");

            // Modello 2: "summaryModel" - Serve per tenere traccia dei totali a fondo pagina.
            // Dato che abbiamo rimosso ordersModel, ci serve un nuovo posto dove salvare i numeri calcolati.
            var oSummaryModel = new JSONModel({
                TotalCount: 0,
                TotalValue: 0.00
            });
            this.setModel(oSummaryModel, "summaryModel");
        },

        // ------------------------------------------------------------------------
        // 2. NAVIGAZIONE AL DETTAGLIO ORDINE
        // ------------------------------------------------------------------------
        onNavToDetail: function (oEvent) {
            // Capiamo quale riga esatta della tabella è stata cliccata
            var oItem = oEvent.getSource();
            
            // Prendiamo il collegamento (Context) tra quella riga e i dati OData del server
            var oBindingContext = oItem.getBindingContext(); 
            
            // Estraiamo la chiave univoca: il Numero dell'Ordine
            var sNumOrdine = oBindingContext.getProperty("NumOrdine");

            // Diciamo al Router di cambiare pagina verso "RouteOrderDetail" 
            // passando l'ID dell'ordine nell'URL
            this.getRouter().navTo("RouteOrderDetail", {
                orderId: sNumOrdine
            });
        },

        // ------------------------------------------------------------------------
        // 3. CALCOLO DEI TOTALI (LOGICA ODATA)
        // ------------------------------------------------------------------------
        onTableUpdateFinished: function () {
            // Scatta ogni volta che la tabella finisce di caricare dati dal server
            this._calculateTotal();
        },

        _calculateTotal: function () {
            // Con OData, non abbiamo tutto il database in memoria, ma solo le righe scaricate (paginazione).
            // Quindi chiediamo alla tabella quali righe ha attualmente a schermo.
            var oTable = this.byId("ordersTable");
            var aContexts = oTable.getBinding("items").getContexts(); 

            var iTotalCount = 0;   // Contatore del numero di ordini
            var fTotalValue = 0;   // Somma del fatturato

            // Cicliamo le righe caricate dalla tabella
            aContexts.forEach(function (oContext) {
                // Leggiamo lo stato e l'importo direttamente dal "contesto" OData
                var sStatus = oContext.getProperty("StatoTxt");
                var sImporto = oContext.getProperty("ImportoTot");

                // Escludiamo dal conteggio gli ordini cancellati
                if (sStatus !== "Cancellato") {
                    iTotalCount++; 
                    // Il server ci manda stringhe, dobbiamo convertirle in numeri decimali (Float)
                    fTotalValue += parseFloat(sImporto || 0); 
                }
            });

            // Salviamo i risultati nel nostro "summaryModel".
            // Aggiorna l'XML della vista (Home.view.xml) in basso per usare {summaryModel>/TotalCount}
            var oSummaryModel = this.getModel("summaryModel");
            oSummaryModel.setProperty("/TotalCount", iTotalCount);
            oSummaryModel.setProperty("/TotalValue", fTotalValue.toFixed(2));
        },

        // ------------------------------------------------------------------------
        // 4. ESPORTAZIONE EXCEL (ADATTATA A ODATA)
        // ------------------------------------------------------------------------
        onExport: function () {
            var oBundle = this.getResourceBundle();
            
            // Definiamo le colonne dell'Excel usando le proprietà dell'entità ZES_lista_ordiniSet
            var aCols = [
                { label: oBundle.getText("colOrderID"), property: "NumOrdine" },
                { label: oBundle.getText("colCustomer"), property: "Cliente" },
                { label: "Data Ordine", property: "DataOrdine", type: "date", format: "dd/MM/yyyy" },
                { label: "Totale (€)", property: "ImportoTot", type: "number" },
                { label: oBundle.getText("colStatus"), property: "StatoTxt" }
            ];

            // Peschiamo i dati attualmente visualizzati in tabella
            var oTable = this.byId("ordersTable");
            var aContexts = oTable.getBinding("items").getContexts();
            
            // Trasformiamo i contesti OData in semplici oggetti JavaScript leggibili da Excel
            var aData = aContexts.map(function (oContext) {
                return oContext.getObject();
            });

            // Configuriamo l'esportazione
            var oSettings = {
                workbook: { columns: aCols },
                dataSource: aData, // Usiamo i dati appena estratti
                fileName: "Orders_Export.xlsx"
            };

            // Costruiamo e scarichiamo il file
            var oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function () {
                oSheet.destroy(); // Puliamo la memoria
            });
        },

        // ------------------------------------------------------------------------
        // 5. RICERCA FILTRATA (ADATTATA A ODATA)
        // ------------------------------------------------------------------------
        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue");
            var aFilters = [];

            if (sQuery && sQuery.length > 0) {
                // Creiamo un filtro che cerca per NOME CLIENTE (Campo "Cliente" su SAP)
                // OData spedirà questo filtro al server che farà la ricerca nel database!
                aFilters.push(new Filter("Cliente", FilterOperator.Contains, sQuery));
            }

            // Applichiamo il filtro alla tabella. 
            // In background, SAPUI5 farà una nuova chiamata di rete al backend.
            this.byId("ordersTable").getBinding("items").filter(aFilters);
        },

        // ------------------------------------------------------------------------
        // 6. GESTIONE DIALOG (MODAL) E DEEP INSERT
        // ------------------------------------------------------------------------
        onOpenAddDialog: function () {
            // Svuotiamo il form prima di aprirlo, per evitare che mostri dati vecchi
            var oFormModel = this.getModel("formModel");
            oFormModel.setProperty("/newOrder", {
                CustomerName: "", ArticleCode: "", ProductName: "", Quantity: 1, UnitPrice: 0
            });
            this.byId("addOrderDialog").open();
        },

        onCancelOrder: function () {
            this.byId("addOrderDialog").close();
        },

        onSaveOrder: function () {
            var oFormModel = this.getModel("formModel"); 
            var oODataModel = this.getModel();           
            var oBundle = this.getResourceBundle();
            var oFormData = oFormModel.getProperty("/newOrder");

            // Validazione per evitare invii di ordini vuoti
            if (!oFormData.CustomerName || !oFormData.ArticleCode) {
                MessageBox.error("Compila i campi obbligatori (Cliente e Codice Articolo).");
                return;
            }

            // Calcoli
            var iQuantita = parseInt(oFormData.Quantity) || 1;
            var iPrezzo = parseInt(oFormData.UnitPrice) || 0;
            var iImportoTotale = iQuantita * iPrezzo;

            // IL PAYLOAD PERFETTO (Basato sulle specifiche del documento)
            var oDeepPayload = {
                // 1. Campi della testata Deep (LA CHIAVE È "Operation": "C")
                "Operation": "C", 
                // "NumOrdine" non lo mandiamo, dice il documento che è progressivo automatico
                
                // 2. Navigation Property: Dati Cliente
                "ZET_lista_ordini": {
                    "Cliente": oFormData.CustomerName,
                    "DataOrdine": new Date(), // Lasciamo l'oggetto Date, SAPUI5 V2 Model di solito lo gestisce.
                    "ImportoTot": iImportoTotale,
                    "Stato": 1 
                },
                
                // 3. Navigation Property: Array degli Articoli
                "ZET_dettagli_ordiniSet": [
                    {
                        "CodArticolo": parseInt(oFormData.ArticleCode),
                        "NomeArticolo": oFormData.ProductName,
                        "QuantitaOrdine": iQuantita,
                        "Importo": iPrezzo
                    }
                ]
            };

            sap.ui.core.BusyIndicator.show(0);
            var that = this;

            // Inviamo a SAP!
            oODataModel.create("/ZES_DeepOrdiniSet", oDeepPayload, {
                success: function (oData) {
                    sap.ui.core.BusyIndicator.hide();
                    
                    // Se il backend ci restituisce l'ID creato, lo mostriamo
                    var sNuovoId = oData.ZET_lista_ordini ? oData.ZET_lista_ordini.NumOrdine : "sconosciuto";
                    MessageToast.show("Ordine " + sNuovoId + " creato con successo!");
                    
                    that.onCancelOrder();
                    oODataModel.refresh(true); // Ricarichiamo la tabella
                },
                error: function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    that._handleBackendError(oError); 
                }
            });
        },

        // ------------------------------------------------------------------------
        // 7. ELIMINAZIONE ORDINE (DELETE ODATA)
        // ------------------------------------------------------------------------
        onDeleteOrder: function (oEvent) {
            // ---------------------------------------------------------
            // 1. IDENTIFICARE L'ORDINE CLICCATO
            // ---------------------------------------------------------
            // oEvent contiene le informazioni sull'azione appena compiuta (il click sul cestino).
            // .getParameter("listItem") ci dice esattamente quale riga della tabella è stata cliccata.
            // .getBindingContext() recupera il "collegamento" (contesto OData) di quella riga.
            var oContext = oEvent.getParameter("listItem").getBindingContext();

            // ---------------------------------------------------------
            // 2. ESTRARRE I DATI ORIGINALI
            // ---------------------------------------------------------
            // .getObject() tira fuori dal contesto tutti i dati reali di quella riga 
            // (NumOrdine, Cliente, Data, Importo, ecc.).
            // Ci servono perché il backend vuole ricevere indietro tutta la testata compilata, 
            // non possiamo passargli solo lo stato.
            var oDatiRiga = oContext.getObject(); 
            
            // Salviamo i riferimenti al modello dati SAP e al controller (this) 
            // per usarli più avanti dentro la funzione di risposta (success/error).
            var oODataModel = this.getModel();
            var that = this;

            // ---------------------------------------------------------
            // 3. CHIEDERE CONFERMA ALL'UTENTE
            // ---------------------------------------------------------
            // È sempre buona regola usare un MessageBox prima di un'azione distruttiva.
            MessageBox.confirm("Sei sicura di voler chiudere (eliminare) questo ordine?", {
                title: "Conferma Eliminazione",
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                
                // Questa funzione scatta quando l'utente sceglie una delle opzioni
                onClose: function (sAction) {
                    
                    // Se l'utente ha effettivamente cliccato "Sì"...
                    if (sAction === MessageBox.Action.YES) {
                        
                        // Blocchiamo l'interfaccia mostrando la rotellina di caricamento
                        sap.ui.core.BusyIndicator.show(0);
                        
                        // ---------------------------------------------------------
                        // 4. COSTRUIRE IL PAYLOAD (IL PACCHETTO DATI) PER IL SOFT DELETE
                        // ---------------------------------------------------------
                        // Visto che il server va in errore (dump) con la DELETE standard, 
                        // facciamo un "Soft Delete": aggiorniamo l'ordine cambiandogli stato.
                        // Il manuale del backend impone l'uso della struttura "Deep" passandogli "Operation: U".
                        var oUpdatePayload = {
                            "Operation": "U", // "U" sta per Update (Aggiornamento parziale)
                            "NumOrdine": parseInt(oDatiRiga.NumOrdine), // ID ordine obbligatorio per l'update
                            
                            // Compiliamo la testata rimettendo esattamente i dati originali estratti al punto 2...
                            "ZET_lista_ordini": {
                                "NumOrdine": parseInt(oDatiRiga.NumOrdine),
                                "Cliente": oDatiRiga.Cliente,
                                "DataOrdine": oDatiRiga.DataOrdine, // Rimandiamo la data intatta senza toccarla
                                "ImportoTot": parseFloat(oDatiRiga.ImportoTot),
                                
                                // ...TRANNE LO STATO!
                                // Sostituiamo lo stato originale con '4', che a backend significa "Chiuso"
                                "Stato": 4 
                            },
                            
                            // Il manuale dice che l'Update aggiorna solo lo stato, quindi gli articoli
                            // non servono. Passiamo l'array vuoto solo per mantenere valida la struttura Deep.
                            "ZET_dettagli_ordiniSet": [] 
                        };

                        // ---------------------------------------------------------
                        // 5. INVIARE LA RICHIESTA AL SERVER SAP
                        // ---------------------------------------------------------
                        oODataModel.create("/ZES_DeepOrdiniSet", oUpdatePayload, {
                            
                            // Se il server risponde "OK" (Status 200/201)
                            success: function () {
                                sap.ui.core.BusyIndicator.hide(); // Sblocchiamo lo schermo
                                MessageToast.show("Ordine chiuso con successo."); // Feedback all'utente
                                
                                // ---------------------------------------------------------
                                // 6. AGGIORNARE LA TABELLA
                                // ---------------------------------------------------------
                                // Costringiamo la tabella a riscaricare i dati dal server.
                                // Così vedremo la colonna "Stato" della nostra riga cambiare all'istante!
                                oODataModel.refresh(true); 
                            },
                            
                            // Se il server ci rimbalza (Status 4xx o 5xx)
                            error: function (oError) {
                                sap.ui.core.BusyIndicator.hide(); // Sblocchiamo lo schermo in ogni caso
                                that._handleBackendError(oError); // Estraiamo e leggiamo l'errore di SAP
                            }
                        });
                    }
                }
            });
        },

        // ------------------------------------------------------------------------
        // 8. FUNZIONE DI SUPPORTO PER GLI ERRORI
        // ------------------------------------------------------------------------
        _handleBackendError: function (oError) {
            var sMsg = "Si è verificato un errore nel server SAP."; 
            try {
                // Cerca di estrarre il messaggio di errore specifico mandato dal backend ABAP
                var oErrorObj = JSON.parse(oError.responseText);
                if (oErrorObj.error && oErrorObj.error.message && oErrorObj.error.message.value) {
                    sMsg = oErrorObj.error.message.value;
                }
            } catch (e) {
                // Fallback nel caso la risposta non sia un JSON
            }
            MessageBox.error(sMsg);
        }

    });
});