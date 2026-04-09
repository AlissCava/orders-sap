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

        formatter: formatter,

        onInit: function () {
            // Crea un modello JSON per gestire i conteggi totali della vista
            const oSummaryModel = new JSONModel({
                TotalCount: 0, // Inizializza il contatore ordini a zero
                TotalValue: 0.00 // Inizializza il valore totale a zero
            });
            // Assegna il modello alla vista con il nome "summaryModel"
            this.setModel(oSummaryModel, "summaryModel");
        },

        // ========================================================================
        // NAVIGAZIONE
        // ========================================================================
        onNavToCreateOrder: function () {
            // Naviga alla rotta del form passandogli la costante "new"
            this.getRouter().navTo("RouteOrderForm", {
                objectId: "new"
            });
        },

        onNavToDetail: function (oEvent) {
            // Ottiene l'elemento che ha generato l'evento (la riga)
            const oItem = oEvent.getSource();
            // Ottiene il contesto di binding della riga
            const oBindingContext = oItem.getBindingContext(); 
            // Estrae il valore della proprietà "NumOrdine" dal modello
            const sOrderNum = oBindingContext.getProperty("NumOrdine");

            // Naviga alla rotta del form passando il numero ordine specifico
            this.getRouter().navTo("RouteOrderForm", {
                objectId: sOrderNum
            });
        },

        // ========================================================================
        // TOTALI DINAMICI
        // ========================================================================
        onTableUpdateFinished: function () {
            // Chiamata quando i dati sono stati caricati e la tabella è aggiornata
            this._calculateTotal();
        },

        _calculateTotal: function () {
            // Recupera l'istanza della tabella tramite ID
            const oTable = this.byId("ordersTable");
            // Estrae tutti i contesti delle righe attualmente caricate
            const aContexts = oTable.getBinding("items").getContexts(); 

            let iTotalCount = 0; // Variabile d'appoggio per il conteggio  
            let fTotalValue = 0; // Variabile d'appoggio per la somma degli importi  

            // Cicla su ogni contesto riga ricevuto
            aContexts.forEach(function (oContext) {
                // Recupera lo stato e l'importo della singola riga
                const sStatus = oContext.getProperty("StatoTxt");
                const sAmount = oContext.getProperty("ImportoTot");

                // Filtra solo gli ordini che non hanno stato "Cancellato"
                if (sStatus !== "Cancellato") {
                    iTotalCount++; // Incrementa il numero degli ordini
                    fTotalValue += parseFloat(sAmount || 0); // Somma l'importo convertendolo in numero
                }
            });

            // Recupera il modello di riepilogo definito in onInit
            const oSummaryModel = this.getModel("summaryModel");
            // Aggiorna la proprietà del numero totale ordini
            oSummaryModel.setProperty("/TotalCount", iTotalCount);
            // Aggiorna la proprietà del valore totale formattando a due decimali
            oSummaryModel.setProperty("/TotalValue", fTotalValue.toFixed(2)); 
        },

        // ========================================================================
        // EXPORT EXCEL
        // ========================================================================
        onExport: function () {
            // Recupera il bundle delle traduzioni
            const oBundle = this.getResourceBundle();
            
            // Definisce l'array delle colonne con etichette i18n e proprietà tecniche
            const aCols = [
                { label: oBundle.getText("colOrderID"), property: "NumOrdine" },
                { label: oBundle.getText("colCustomer"), property: "Cliente" },
                { label: oBundle.getText("colOrderDate"), property: "DataOrdine", type: "date", format: "dd/MM/yyyy" },
                { label: oBundle.getText("colTotalAmount"), property: "ImportoTot", type: "number" },
                { label: oBundle.getText("colStatus"), property: "StatoTxt" }
            ];

            // Recupera la tabella e i contesti delle righe
            const oTable = this.byId("ordersTable");
            const aContexts = oTable.getBinding("items").getContexts();
            
            // Mappa i contesti OData in un array di oggetti JavaScript semplici
            const aData = aContexts.map(function (oContext) {
                return oContext.getObject();
            });

            // Configura le impostazioni per la generazione del foglio di calcolo
            const oSettings = {
                workbook: { columns: aCols },
                dataSource: aData, 
                fileName: "Orders_Export.xlsx"
            };

            // Crea l'istanza Spreadsheet, avvia il build e distrugge l'oggetto alla fine
            const oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function () {
                oSheet.destroy(); 
            });
        },

        // ========================================================================
        // RICERCA FILTRATA ODATA (TESTO + STATO)
        // ========================================================================
        onSearch: function (oEvent) {
            // Prepariamo un cesto vuoto dove mettere i filtri
            const aFilters = [];

            // 1. Leggiamo il valore della barra di ricerca (Nome Cliente)
            // Siccome questa funzione scatta sia quando scrivi sia quando cambi la tendina,
            // non possiamo usare oEvent.getParameter("newValue"), ma andiamo a leggere direttamente il campo.
            const sSearchQuery = this.byId("ordersTable").getHeaderToolbar().getContent()[0].getValue();

            // 2. Leggiamo il valore selezionato nella tendina dello stato
            const sStatusQuery = this.byId("statusFilter").getSelectedKey();

            // Se c'è testo nel nome cliente, aggiungiamo il filtro Contains
            if (sSearchQuery && sSearchQuery.length > 0) {
                aFilters.push(new Filter("Cliente", FilterOperator.Contains, sSearchQuery));
            }

            // Se è stato scelto uno stato specifico (diverso da "Tutti gli Stati" che ha key vuota)
            if (sStatusQuery && sStatusQuery !== "") {
                aFilters.push(new Filter("StatoTxt", FilterOperator.Equals, sStatusQuery));
            }

            // Diciamo alla tabella di applicare tutti i filtri raccolti!
            this.byId("ordersTable").getBinding("items").filter(aFilters);
        },

        // ========================================================================
        // SOFT DELETE (DEEP INSERT)
        // ========================================================================
        onDeleteOrder: function (oEvent) {
            // Recupera il contesto della riga cliccata dal parametro dell'evento
            const oContext = oEvent.getParameter("listItem").getBindingContext();
            // Ottiene l'oggetto dati completo della riga
            const oRowData = oContext.getObject(); 
            const that = this; // Salva il riferimento al controller

            // Apre un box di conferma con opzioni SI/NO
            MessageBox.confirm(this.getText("msgDeleteConfirm"), {
                title: this.getText("appTitle"),
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                
                onClose: function (sAction) {
                    // Se l'utente clicca su SI procede con l'operazione
                    if (sAction === MessageBox.Action.YES) {
                        sap.ui.core.BusyIndicator.show(0); // Mostra l'indicatore di attesa
                        
                        // Definisce il payload per la Deep Insert di aggiornamento stato
                        const oUpdatePayload = {
                            "Operation": "U", // Flag per indicare l'operazione di Update al backend
                            "NumOrdine": parseInt(oRowData.NumOrdine, 10), 
                            "ZET_lista_ordini": {
                                "NumOrdine": parseInt(oRowData.NumOrdine, 10),
                                "Cliente": oRowData.Cliente,
                                "DataOrdine": oRowData.DataOrdine, 
                                "ImportoTot": parseFloat(oRowData.ImportoTot),
                                "Stato": 4 // Imposta lo stato a 4 (Chiuso)
                            },
                            "ZET_dettagli_ordiniSet": [] // Array vuoto per i dettagli (non modificati)
                        };

                        // Invia il payload al servizio OData tramite odataCreate (Deep)
                        that.odataCreate("/ZES_DeepOrdiniSet", oUpdatePayload)
                        .then(function () {
                            sap.ui.core.BusyIndicator.hide(); // Nasconde il BusyIndicator
                            MessageToast.show(that.getText("msgOrderCloseConfirm")); // Notifica successo
                            that.getModel().refresh(true); // Ricarica il modello OData principale
                        })
                        .catch(function (oError) {
                            sap.ui.core.BusyIndicator.hide(); // Nasconde il BusyIndicator in caso di errore
                            that.handleBackendError(oError); // Gestisce l'errore tramite metodo centralizzato
                        });
                    }
                }
            });
        },

        // ========================================================================
        // GESTIONE ORDINAMENTO (SORT)
        // ========================================================================
        onSort: function () {
            // 1. Recuperiamo il binding degli elementi della tabella
            const oTable = this.byId("ordersTable");
            const oBinding = oTable.getBinding("items");

            // 2. Creiamo una variabile per decidere la direzione (la salviamo nel controller per ricordarcela)
            // Se non esiste, iniziamo con decrescente (true)
            this._bSortDescending = !this._bSortDescending;

            // 3. Creiamo l'oggetto Sorter. 
            // Parametro 1: Il campo del database (es. "DataOrdine")
            // Parametro 2: Booleano per il verso (true = decrescente, false = crescente)
            const oSorter = new Sorter("DataOrdine", this._bSortDescending);

            // 4. Applichiamo l'ordinamento alla tabella
            oBinding.sort(oSorter);

            // Opzionale: un piccolo feedback per l'utente
            const sMessage = this._bSortDescending ? "Ordinato per data (Recenti prima)" : "Ordinato per data (Vecchi prima)";
            MessageToast.show(sMessage);
        },

    });
});