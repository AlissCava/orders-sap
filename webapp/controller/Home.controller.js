sap.ui.define([
    "orders/controller/BaseController", 
    "sap/ui/export/Spreadsheet",        
    "sap/ui/model/Filter",              
    "sap/ui/model/FilterOperator",      
    "sap/ui/model/json/JSONModel",      
    "sap/m/MessageBox",                 
    "sap/m/MessageToast",
    "sap/ui/model/Sorter",
    "sap/ui/core/InvisibleMessage", 
    "sap/ui/core/library",
    "orders/model/formatter"              
], function (BaseController, Spreadsheet, Filter, FilterOperator, JSONModel, MessageBox, MessageToast, Sorter, formatter) {
    "use strict";

    return BaseController.extend("orders.controller.Home", {

        // Collega il file dei formatter alla vista, essenziale per i colori degli stati e la valuta
        formatter: formatter,

        onInit: function () {
            // Crea un modello JSON locale esclusivamente per gestire i conteggi a fondo pagina
            const oSummaryModel = new JSONModel({
                TotalCount: 0,   // Inizializza il contatore del numero di ordini a zero
                TotalValue: 0.00 // Inizializza la somma in euro a zero
            });
            
            // Assegna il modello alla vista nominandolo "summaryModel", 
            // così la vista XML sa esattamente dove andare a leggere questi numeri
            this.setModel(oSummaryModel, "summaryModel");
        },

        // ========================================================================
        // NAVIGAZIONE
        // ========================================================================
        onNavToCreateOrder: function () {
            // Naviga alla rotta del dettaglio ordine, ma passa la stringa speciale "new".
            // Il controller del dettaglio capirà che deve aprire un form vuoto per la creazione.
            this.getRouter().navTo("RouteOrderForm", {
                objectId: "new"
            });
        },

        onNavToDetail: function (oEvent) {
            // Ottiene l'elemento fisico della tabella su cui l'utente ha cliccato (la riga)
            const oItem = oEvent.getSource();
            
            // Ottiene il contesto dei dati (la porzione di database associata a quella specifica riga)
            const oBindingContext = oItem.getBindingContext(); 
            
            // Estrae dal contesto il numero esatto dell'ordine cliccato
            const sOrderNum = oBindingContext.getProperty("NumOrdine");

            // Naviga alla rotta del dettaglio passando l'ID dell'ordine reale.
            // Il controller del dettaglio userà questo ID per scaricare i dati completi.
            this.getRouter().navTo("RouteOrderForm", {
                objectId: sOrderNum
            });
        },

        // ========================================================================
        // TOTALI DINAMICI (Versione Anti-Zombie)
        // ========================================================================
        onTableUpdateFinished: function (oEvent) {
            // Questo evento scatta in automatico ogni volta che la tabella finisce di 
            // disegnare i dati (al caricamento, dopo un filtro, o dopo un ordinamento).
            // Deleghiamo il calcolo a una funzione separata per mantenere il codice pulito.
            this._calculateTotal();
        },

        _calculateTotal: function () {
            // Recupera l'istanza della tabella tramite il suo ID dichiarato nell'XML
            const oTable = this.byId("ordersTable");
            
            // PREVENZIONE BUG BACKEND: 
            // Usiamo getItems() per prendere solo le righe che l'utente vede fisicamente a schermo,
            // ignorando il modello in memoria (che potrebbe contenere record non cancellati per colpa della mancanza di COMMIT).
            const aItems = oTable.getItems(); 

            let iTotalCount = 0; // Variabile d'appoggio per contare le righe valide  
            let fTotalValue = 0; // Variabile d'appoggio per sommare gli euro  

            // Analizziamo una ad una le righe visibili
            aItems.forEach(function (oItem) {
                const oContext = oItem.getBindingContext();
                
                // Se la riga ha dei dati validi ad essa associati
                if (oContext) {
                    // Leggiamo lo stato e l'importo di quella riga specifica
                    const sStatus = oContext.getProperty("StatoTxt");
                    const sAmount = oContext.getProperty("ImportoTot");

                    // Contiamo la riga e sommiamo i soldi SOLO se l'ordine non è stato cancellato.
                    if (sStatus !== "Cancellato") {
                        iTotalCount++; 
                        fTotalValue += parseFloat(sAmount || 0); // parseFloat trasforma la stringa in un numero decimale
                    }
                }
            });

            // Peschiamo il modello dei totali che avevamo creato in onInit
            const oSummaryModel = this.getModel("summaryModel");
            
            if (oSummaryModel) {
                // Scriviamo i nuovi calcoli nel modello. La vista XML si aggiornerà all'istante da sola.
                oSummaryModel.setProperty("/TotalCount", iTotalCount);
                oSummaryModel.setProperty("/TotalValue", fTotalValue.toFixed(2)); // toFixed(2) forza i due decimali (es. 10.50)
                
                // Generiamo il titolo formattato con il conteggio reale dei record attivi
                oSummaryModel.setProperty("/TableTitle", "Ordini (" + iTotalCount + ")");
            }
        },

        // ========================================================================
        // EXPORT EXCEL
        // ========================================================================
        onExport: async function () {
            // Recupera il file i18n.properties per usare le traduzioni corrette per le intestazioni
            const oBundle = this.getResourceBundle();
            const that = this; // Salviamo il riferimento al controller per poter chiamare il formatter
            
            // Configura le colonne del file Excel collegando l'etichetta tradotta al nome tecnico del database
            const aCols = [
                { label: oBundle.getText("colOrderID"), property: "NumOrdine", type: "number" },
                { label: oBundle.getText("colCustomer"), property: "Cliente", type: "string" },
                { label: oBundle.getText("colOrderDate"), property: "DataOrdine", type: "date", format: "dd/MM/yyyy" },
                { label: oBundle.getText("colTotalAmount"), property: "ImportoFormattato", type: "string" },
                { label: oBundle.getText("colStatus"), property: "StatoTxt", type: "string" }
            ];

            // Prende i dati attualmente legati alla tabella
            const oTable = this.byId("ordersTable");
            const aContexts = oTable.getBinding("items").getContexts();
            
            // "Srotola" i contesti complessi di UI5 in semplici oggetti Javascript leggibili dalla libreria Excel
            const aData = aContexts.map(function (oContext) {
                const oRow = oContext.getObject();
                
                // Creiamo un clone della riga per non alterare i dati originali in memoria
                const oExportRow = Object.assign({}, oRow);
                
                // Usiamo lo stesso formatter dell'interfaccia per creare la stringa esatta (es. "1200.00 €")
                oExportRow.ImportoFormattato = that.formatter.currencyValue(oRow.ImportoTot);
                
                return oExportRow;
            });

            // Prepara il file da generare
            const oSettings = {
                workbook: { columns: aCols },
                dataSource: aData, 
                fileName: "Orders_Export.xlsx"
            };

            // Crea l'oggetto per generare l'Excel
            const oSheet = new Spreadsheet(oSettings);
            
            try {
                // Avvia la creazione del file in modo asincrono
                await oSheet.build();
            } finally {
                // Libera la memoria (destroy) appena il download è partito o se c'è un errore
                oSheet.destroy(); 
            }
        },

        // ========================================================================
        // RICERCA FILTRATA ODATA (TESTO + STATO NUMERICO + DATE)
        // ========================================================================
        onSearch: function (oEvent) {
            var aFilters = [];

            // 1. Lettura Testo
            var oSearchField = this.byId("searchField");
            var sSearchQuery = oSearchField ? oSearchField.getValue() : "";

            // 2. Lettura Stato
            var sStatusKey = this.byId("statusFilter").getSelectedKey();

            // 3. Lettura Date
            var oDateRange = this.byId("dateFilter");
            var oDateFrom = oDateRange ? oDateRange.getDateValue() : null;
            var oDateTo = oDateRange ? oDateRange.getSecondDateValue() : null;

            // Filtro Testo
            if (sSearchQuery && sSearchQuery.length > 0) {
                aFilters.push(new Filter("Cliente", FilterOperator.Contains, sSearchQuery));
            }

            // Filtro Stato (Conversione in numero)
            if (sStatusKey && sStatusKey !== "") {
                var iStatoNumero = parseInt(sStatusKey, 10);
                aFilters.push(new Filter("Stato", FilterOperator.EQ, iStatoNumero));
            }

            // Filtro Date (Approccio Minimalista: passaggio date crudo)
            if (oDateFrom) {
                var oStart = oDateFrom;
                var oEnd = oDateTo ? oDateTo : oDateFrom;

                aFilters.push(new Filter("DataOrdine", FilterOperator.BT, oStart, oEnd));
            }

            // Applica tutto alla tabella
            this.byId("ordersTable").getBinding("items").filter(aFilters);
        },

        // ========================================================================
        // SOFT DELETE (ARCHIVIAZIONE CON WORKAROUND LOCALE)
        // ========================================================================
        onDeleteOrder: function (oEvent) {
            // Catturiamo il contesto dal bottone personalizzato
            const oContext = oEvent.getSource().getBindingContext();
            const oRowData = oContext.getObject(); 
            const that = this; 

            // Chiediamo conferma all'utente prima di procedere
            MessageBox.confirm(this.getText("msgDeleteConfirm"), {
                title: this.getText("appTitle"),
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                
                // Rendiamo la chiusura asincrona
                onClose: async function (sAction) {
                    if (sAction === MessageBox.Action.YES) {
                        sap.ui.core.BusyIndicator.show(0); 
                        
                        // Creiamo il pacchetto per la Deep Insert per fare un Update dello stato
                        const oUpdatePayload = {
                            "Operation": "U", 
                            "NumOrdine": parseInt(oRowData.NumOrdine, 10), 
                            "ZET_lista_ordini": {
                                "NumOrdine": parseInt(oRowData.NumOrdine, 10),
                                "Cliente": oRowData.Cliente,
                                "DataOrdine": oRowData.DataOrdine, 
                                "ImportoTot": parseFloat(oRowData.ImportoTot),
                                "Stato": 4 // Muoviamo l'ordine nello stato Chiuso/Cancellato
                            },
                            "ZET_dettagli_ordiniSet": [] 
                        };

                        try {
                            // Spediamo la richiesta al server SAP usando await
                            await that.odataCreate("/ZES_DeepOrdiniSet", oUpdatePayload);
                            
                            sap.ui.core.BusyIndicator.hide(); 
                            
                            // --- INIZIO MAGIA A11Y ---
                            // Mostri il messaggio visivo per i vedenti
                            MessageToast.show("Ordine archiviato con successo"); 
                            
                            // Fai l'annuncio vocale per lo screen reader (sostituisci il vecchio MessageToast)
                            var oInvisibleMessage = sap.ui.core.InvisibleMessage.getInstance();
                            oInvisibleMessage.announce("Ordine archiviato con successo", sap.ui.core.InvisibleMessageMode.Assertive);
                            // --- FINE MAGIA A11Y ---
                            
                            // WORKAROUND: Siccome il backend non esegue la COMMIT WORK...
                            const sPath = oContext.getPath();
                            that.getModel().setProperty(sPath + "/StatoTxt", "Cancellato");
                            that.getModel().setProperty(sPath + "/Stato", 4);
                            
                            // Ricalcoliamo i totali in basso (che ora escluderanno la riga appena cancellata)
                            that._calculateTotal();

                        } catch (oError) {
                            sap.ui.core.BusyIndicator.hide(); 
                            that.handleBackendError(oError); 
                        }
                    }
                }
            });
        },
        
        // ========================================================================
        // GESTIONE ORDINAMENTO MULTIPLO (SORT VIA DIALOG)
        // ========================================================================
        onSort: function () {
            var that = this;

            // Creiamo il dialog dinamicamente solo la prima volta che si clicca il bottone
            if (!this._oSortDialog) {
                this._oSortDialog = new sap.m.ViewSettingsDialog({
                    title: "Ordina per",
                    sortItems: [
                        new sap.m.ViewSettingsItem({ text: "ID Ordine", key: "NumOrdine" }),
                        new sap.m.ViewSettingsItem({ text: "Cliente", key: "Cliente" }),
                        new sap.m.ViewSettingsItem({ text: "Data Ordine", key: "DataOrdine" }),
                        new sap.m.ViewSettingsItem({ text: "Totale (€)", key: "ImportoTot" }),
                        new sap.m.ViewSettingsItem({ text: "Stato", key: "StatoTxt" })
                    ],
                    confirm: function (oEvent) {
                        // Recuperiamo la scelta dell'utente
                        var oParams = oEvent.getParameters();
                        var sPath = oParams.sortItem.getKey();
                        var bDescending = oParams.sortDescending;
                        
                        // Creiamo e applichiamo il nuovo ordinatore usando Sorter iniettato
                        var aSorters = [];
                        aSorters.push(new Sorter(sPath, bDescending));
                        
                        var oTable = that.byId("ordersTable");
                        var oBinding = oTable.getBinding("items");
                        oBinding.sort(aSorters);
                    }
                });
                
                // Leghiamo il dialog alla vista per ereditare i modelli
                this.getView().addDependent(this._oSortDialog);
            }

            // Apriamo il popup
            this._oSortDialog.open();
        }

    });
});