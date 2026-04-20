sap.ui.define([
    "orders/controller/BaseController", 
    "sap/ui/export/Spreadsheet",        
    "sap/ui/model/Filter",              
    "sap/ui/model/FilterOperator",      
    "sap/ui/model/json/JSONModel",      
    "sap/m/MessageBox",                 
    "sap/m/MessageToast",
    "sap/ui/model/Sorter",
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
            }
        },

        // ========================================================================
        // EXPORT EXCEL
        // ========================================================================
        onExport: function () {
            // Recupera il file i18n.properties per usare le traduzioni corrette per le intestazioni
            const oBundle = this.getResourceBundle();
            
            // Configura le colonne del file Excel collegando l'etichetta tradotta al nome tecnico del database
            const aCols = [
                { label: oBundle.getText("colOrderID"), property: "NumOrdine", type: "number" },
                { label: oBundle.getText("colCustomer"), property: "Cliente", type: "string" },
                { label: oBundle.getText("colOrderDate"), property: "DataOrdine", type: "date", format: "dd/MM/yyyy" },
                { label: oBundle.getText("colTotalAmount"), property: "ImportoTot", type: "number" },
                { label: oBundle.getText("colStatus"), property: "StatoTxt", type: "string" }
            ];

            // Prende i dati attualmente legati alla tabella
            const oTable = this.byId("ordersTable");
            const aContexts = oTable.getBinding("items").getContexts();
            
            // "Srotola" i contesti complessi di UI5 in semplici oggetti Javascript leggibili dalla libreria Excel
            const aData = aContexts.map(function (oContext) {
                return oContext.getObject();
            });

            // Prepara il file da generare
            const oSettings = {
                workbook: { columns: aCols },
                dataSource: aData, 
                fileName: "Orders_Export.xlsx"
            };

            // Avvia la creazione del file e libera la memoria (destroy) appena il download è partito
            const oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function () {
                oSheet.destroy(); 
            });
        },

        // ========================================================================
        // RICERCA FILTRATA ODATA (TESTO + STATO)
        // ========================================================================
        onSearch: function (oEvent) {
            // Creiamo un array che conterrà tutti i filtri da applicare contemporaneamente
            const aFilters = [];

            // Leggiamo la parola digitata dall'utente nella barra di ricerca
            const sSearchQuery = this.byId("ordersTable").getHeaderToolbar().getContent()[0].getValue();

            // Leggiamo l'opzione selezionata dall'utente nella tendina dello stato
            const sStatusQuery = this.byId("statusFilter").getSelectedKey();

            // Se l'utente ha scritto qualcosa, cerchiamo quella parola all'interno del nome "Cliente" (Contains)
            if (sSearchQuery && sSearchQuery.length > 0) {
                aFilters.push(new Filter("Cliente", FilterOperator.Contains, sSearchQuery));
            }

            // Se l'utente ha scelto uno stato (e non l'opzione vuota "Tutti gli stati"), filtriamo per stato esatto (EQ)
            if (sStatusQuery && sStatusQuery !== "") {
                aFilters.push(new Filter("StatoTxt", FilterOperator.EQ, sStatusQuery));
            }

            // Applichiamo i filtri alla tabella. UI5 chiamerà il backend in automatico per farsi dare i dati giusti.
            this.byId("ordersTable").getBinding("items").filter(aFilters);
        },

        // ========================================================================
        // SOFT DELETE (ARCHIVIAZIONE CON WORKAROUND LOCALE)
        // ========================================================================
        onDeleteOrder: function (oEvent) {
            // Catturiamo il contesto prima di aprire il popup, altrimenti lo perdiamo!
            const oContext = oEvent.getParameter("listItem").getBindingContext();
            const oRowData = oContext.getObject(); 
            const that = this; 

            // Chiediamo conferma all'utente prima di procedere
            MessageBox.confirm(this.getText("msgDeleteConfirm"), {
                title: this.getText("appTitle"),
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                
                onClose: function (sAction) {
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

                        // Spediamo la richiesta al server SAP
                        that.odataCreate("/ZES_DeepOrdiniSet", oUpdatePayload)
                        .then(function () {
                            sap.ui.core.BusyIndicator.hide(); 
                            MessageToast.show("Ordine archiviato con successo"); 
                            
                            // WORKAROUND: Siccome il backend non esegue la COMMIT WORK, se chiediamo
                            // un refresh al server ci rimanderà i dati vecchi. Quindi "forziamo" la UI locale:
                            const sPath = oContext.getPath();
                            that.getModel().setProperty(sPath + "/StatoTxt", "Cancellato");
                            that.getModel().setProperty(sPath + "/Stato", 4);
                            
                            // Ricalcoliamo i totali in basso (che ora escluderanno la riga appena cancellata)
                            that._calculateTotal();
                        })
                        .catch(function (oError) {
                            sap.ui.core.BusyIndicator.hide(); 
                            that.handleBackendError(oError); 
                        });
                    }
                }
            });
        },

        // ========================================================================
        // GESTIONE ORDINAMENTO (SORT)
        // ========================================================================
        onSort: function () {
            // Colleghiamo l'oggetto tabella e il suo contenuto
            const oTable = this.byId("ordersTable");
            const oBinding = oTable.getBinding("items");

            // Invertiamo il flag di ordinamento ogni volta che l'utente preme il pulsante
            this._bSortDescending = !this._bSortDescending;

            // Creiamo un nuovo ordinatore basato sulla data.
            // Il secondo parametro determina se è decrescente (true) o crescente (false)
            const oSorter = new Sorter("DataOrdine", this._bSortDescending);

            // Diamo l'istruzione di riordinare gli elementi
            oBinding.sort(oSorter);

            // Mostriamo un piccolo messaggio a scomparsa per confermare l'azione
            const sMessage = this._bSortDescending ? "Ordinato: Più recenti" : "Ordinato: Meno recenti";
            MessageToast.show(sMessage);
        }

    });
});