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
            // Modello 2: "summaryModel" - Serve per tenere traccia dei totali a fondo pagina.
            // Dato che abbiamo rimosso ordersModel, ci serve un nuovo posto dove salvare i numeri calcolati.
            const oSummaryModel = new JSONModel({
                TotalCount: 0,
                TotalValue: 0.00
            });
            this.setModel(oSummaryModel, "summaryModel");
        },

        // ------------------------------------------------------------------------
        // 2. NAVIGAZIONE AL DETTAGLIO / CREAZIONE ORDINE
        // ------------------------------------------------------------------------
        
        // Clic su "Nuovo Ordine" (Toolbar)
        onNavToCreateOrder: function () {
            // Diciamo al Router di andare alla pagina "OrderForm" passando la parola chiave "new"
            this.getRouter().navTo("RouteOrderForm", {
                objectId: "new"
            });
        },

        // Clic su una riga della tabella
        onNavToDetail: function (oEvent) {
            // Capiamo quale riga esatta della tabella è stata cliccata
            const oItem = oEvent.getSource();
            
            // Prendiamo il collegamento (Context) tra quella riga e i dati OData del server
            const oBindingContext = oItem.getBindingContext(); 
            
            // Estraiamo la chiave univoca: il Numero dell'Ordine (TRADOTTO DA sNumOrdine)
            const sOrderNum = oBindingContext.getProperty("NumOrdine");

            // Diciamo al Router di andare ALLA STESSA pagina "OrderForm", ma passando l'ID vero dell'ordine
            this.getRouter().navTo("RouteOrderForm", {
                objectId: sOrderNum
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
            const oTable = this.byId("ordersTable");
            const aContexts = oTable.getBinding("items").getContexts(); 

            // Usiamo 'let' perché questi valori verranno riassegnati nel ciclo!
            let iTotalCount = 0;   // Contatore del numero di ordini
            let fTotalValue = 0;   // Somma del fatturato

            // Cicliamo le righe caricate dalla tabella
            aContexts.forEach(function (oContext) {
                // Leggiamo lo stato e l'importo direttamente dal "contesto" OData (TRADOTTO DA sImporto)
                const sStatus = oContext.getProperty("StatoTxt");
                const sAmount = oContext.getProperty("ImportoTot");

                // Escludiamo dal conteggio gli ordini cancellati
                if (sStatus !== "Cancellato") {
                    iTotalCount++; 
                    // Il server ci manda stringhe, dobbiamo convertirle in numeri decimali (Float)
                    fTotalValue += parseFloat(sAmount || 0); 
                }
            });

            // Salviamo i risultati nel nostro "summaryModel".
            // Aggiorna l'XML della vista (Home.view.xml) in basso per usare {summaryModel>/TotalCount}
            const oSummaryModel = this.getModel("summaryModel");
            oSummaryModel.setProperty("/TotalCount", iTotalCount);
            oSummaryModel.setProperty("/TotalValue", fTotalValue.toFixed(2));
        },

        // ------------------------------------------------------------------------
        // 4. ESPORTAZIONE EXCEL (ADATTATA A ODATA)
        // ------------------------------------------------------------------------
        onExport: function () {
            const oBundle = this.getResourceBundle();
            
            // Definiamo le colonne dell'Excel usando le proprietà dell'entità ZES_lista_ordiniSet
            const aCols = [
                { label: oBundle.getText("colOrderID"), property: "NumOrdine" },
                { label: oBundle.getText("colCustomer"), property: "Cliente" },
                { label: "Data Ordine", property: "DataOrdine", type: "date", format: "dd/MM/yyyy" },
                { label: "Totale (€)", property: "ImportoTot", type: "number" },
                { label: oBundle.getText("colStatus"), property: "StatoTxt" }
            ];

            // Peschiamo i dati attualmente visualizzati in tabella
            const oTable = this.byId("ordersTable");
            const aContexts = oTable.getBinding("items").getContexts();
            
            // Trasformiamo i contesti OData in semplici oggetti JavaScript leggibili da Excel
            const aData = aContexts.map(function (oContext) {
                return oContext.getObject();
            });

            // Configuriamo l'esportazione
            const oSettings = {
                workbook: { columns: aCols },
                dataSource: aData, // Usiamo i dati appena estratti
                fileName: "Orders_Export.xlsx"
            };

            // Costruiamo e scarichiamo il file
            const oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function () {
                oSheet.destroy(); // Puliamo la memoria
            });
        },

        // ------------------------------------------------------------------------
        // 5. RICERCA FILTRATA (ADATTATA A ODATA)
        // ------------------------------------------------------------------------
        onSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue");
            const aFilters = [];

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
        // 6. ELIMINAZIONE ORDINE (DELETE ODATA)
        // ------------------------------------------------------------------------
        onDeleteOrder: function (oEvent) {
            // ---------------------------------------------------------
            // 1. IDENTIFICARE L'ORDINE CLICCATO
            // ---------------------------------------------------------
            const oContext = oEvent.getParameter("listItem").getBindingContext();

            // ---------------------------------------------------------
            // 2. ESTRARRE I DATI ORIGINALI
            // ---------------------------------------------------------
            // (TRADOTTO DA oDatiRiga)
            const oRowData = oContext.getObject(); 
            
            const oODataModel = this.getModel();
            const that = this;

            // ---------------------------------------------------------
            // 3. CHIEDERE CONFERMA ALL'UTENTE
            // ---------------------------------------------------------
            MessageBox.confirm("Sei sicura di voler chiudere (eliminare) questo ordine?", {
                title: "Conferma Eliminazione",
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.YES) {
                        sap.ui.core.BusyIndicator.show(0);
                        
                        // ---------------------------------------------------------
                        // 4. COSTRUIRE IL PAYLOAD (IL PACCHETTO DATI) PER IL SOFT DELETE
                        // ---------------------------------------------------------
                        const oUpdatePayload = {
                            "Operation": "U", 
                            "NumOrdine": parseInt(oRowData.NumOrdine), 
                            
                            "ZET_lista_ordini": {
                                "NumOrdine": parseInt(oRowData.NumOrdine),
                                "Cliente": oRowData.Cliente,
                                "DataOrdine": oRowData.DataOrdine, 
                                "ImportoTot": parseFloat(oRowData.ImportoTot),
                                "Stato": 4 
                            },
                            "ZET_dettagli_ordiniSet": [] 
                        };

                        // ---------------------------------------------------------
                        // 5. INVIARE LA RICHIESTA AL SERVER SAP
                        // ---------------------------------------------------------
                        oODataModel.create("/ZES_DeepOrdiniSet", oUpdatePayload, {
                            success: function () {
                                sap.ui.core.BusyIndicator.hide(); 
                                MessageToast.show("Ordine chiuso con successo."); 
                                
                                // ---------------------------------------------------------
                                // 6. AGGIORNARE LA TABELLA
                                // ---------------------------------------------------------
                                oODataModel.refresh(true); 
                            },
                            error: function (oError) {
                                sap.ui.core.BusyIndicator.hide(); 
                                that._handleBackendError(oError); 
                            }
                        });
                    }
                }
            });
        },

        // ------------------------------------------------------------------------
        // 7. FUNZIONE DI SUPPORTO PER GLI ERRORI
        // ------------------------------------------------------------------------
        _handleBackendError: function (oError) {
            let sMsg = "Si è verificato un errore nel server SAP."; // Usiamo let per la riassegnazione
            try {
                // Cerca di estrarre il messaggio di errore specifico mandato dal backend ABAP
                const oErrorObj = JSON.parse(oError.responseText);
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