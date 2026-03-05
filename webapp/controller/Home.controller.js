sap.ui.define([
    "orders/controller/BaseController", // Importiamo il nostro BaseController personalizzato
    "sap/ui/export/Spreadsheet",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
], function (BaseController, Spreadsheet, Filter, FilterOperator, JSONModel) {
    "use strict";

    // Estendiamo il BaseController invece del Controller standard
    return BaseController.extend("orders.controller.Home", {

        onInit: function () {
            // REFACTORING: Creiamo un modello JSON locale per il form di creazione.
            // Invece di usare ID per leggere i campi, colleghiamo (bind) gli input a questo oggetto.
            var oLocalModel = new JSONModel({
                newOrder: {
                    CustomerName: "",
                    Product: "",
                    Category: "",
                    Quantity: 1,
                    UnitPrice: 0
                }
            });
            // Assegniamo questo modello alla vista (senza nome, è il modello di default)
            this.setModel(oLocalModel);
        },

        // --- CALCOLO DEI TOTALI (LOGICA REATTIVA) ---
        // Questa funzione scatta quando la tabella ha finito di caricare o filtrare i dati.
        onTableUpdateFinished: function () {
            this._calculateTotal();
        },

        _calculateTotal: function () {
            // Recuperiamo il modello degli ordini tramite la funzione del BaseController
            var oModel = this.getModel("ordersModel");
            var aOrders = oModel.getProperty("/Orders");

            var iTotalCount = 0;   // Contatore numero ordini
            var iTotalItems = 0;   // Contatore pezzi totali
            var fTotalValue = 0;   // Somma del valore economico

            if (aOrders) {
                // Cicliamo l'array degli ordini
                aOrders.forEach(function (oOrder) {
                    if (oOrder.Status !== "Cancellato") {
                        iTotalCount++; // Incremento contatore
                        iTotalItems += parseInt(oOrder.Quantity); // Sommo quantità
                        fTotalValue += (parseFloat(oOrder.UnitPrice) * parseInt(oOrder.Quantity)); // Calcolo riga
                    }
                });
            }

            // CORREZIONE TUTOR: Invece di usare .setText() su un ID, salviamo i risultati nel modello.
            // Grazie al binding "{ordersModel>/Summary/TotalCount}", la UI si aggiorna da sola.
            oModel.setProperty("/Summary/TotalCount", iTotalCount);
            oModel.setProperty("/Summary/TotalItems", iTotalItems);
            oModel.setProperty("/Summary/TotalValue", fTotalValue.toFixed(2));
        },

        // --- ESPORTAZIONE EXCEL (CON TRADUZIONI) ---
        onExport: function () {
            // Recuperiamo il bundle delle traduzioni tramite il BaseController
            var oBundle = this.getResourceBundle();
            
            // Definiamo le colonne dell'Excel usando i testi i18n (es. "Customer" invece di "Cliente")
            var aCols = [
                { label: oBundle.getText("colOrderID"), property: "OrderID" },
                { label: oBundle.getText("colCustomer"), property: "CustomerName" },
                { label: oBundle.getText("colProduct"), property: "Product" },
                { label: oBundle.getText("colQuantity"), property: "Quantity" },
                { label: oBundle.getText("colPrice"), property: "UnitPrice" },
                { label: oBundle.getText("colStatus"), property: "Status" }
            ];

            // Configuriamo l'esportazione con i dati del modello
            var oSettings = {
                workbook: { columns: aCols },
                dataSource: this.getModel("ordersModel").getProperty("/Orders"),
                fileName: "Orders_Export.xlsx"
            };

            // Avviamo la creazione dell'Excel
            var oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function () {
                oSheet.destroy(); // Distruggiamo l'oggetto per liberare memoria RAM
            });
        },

        // --- RICERCA FILTRATA ---
        onSearch: function (oEvent) {
            // Prendiamo il testo digitato dall'utente
            var sQuery = oEvent.getParameter("newValue");
            var aFilters = [];

            if (sQuery && sQuery.length > 0) {
                // Creiamo un filtro che cerca sia nel nome cliente che nel prodotto (OR)
                aFilters.push(new Filter({
                    filters: [
                        new Filter("CustomerName", FilterOperator.Contains, sQuery),
                        new Filter("Product", FilterOperator.Contains, sQuery)
                    ],
                    and: false // 'false' indica che basta che una delle due condizioni sia vera
                }));
            }

            // Applichiamo il filtro al binding degli "items" della tabella
            this.byId("ordersTable").getBinding("items").filter(aFilters);
        },

        // --- GESTIONE DIALOG (MODAL) ---
        onOpenAddDialog: function () {
            // Apre il popup usando il suo ID (qui l'ID serve per trovare l'oggetto Dialog)
            this.byId("addOrderDialog").open();
        },

        onCancelOrder: function () {
            // Chiude il popup
            this.byId("addOrderDialog").close();
        },

        // SALVATAGGIO NUOVO ORDINE (BINDING DIRETTO)
        onSaveOrder: function () {
            // CORREZIONE TUTOR: Non usiamo più .getValue() sugli ID degli input!
            // Leggiamo l'intero oggetto "newOrder" dal modello locale. 
            // SAPUI5 ha già aggiornato questo oggetto mentre l'utente scriveva (Two-way binding).
            var oNewOrderData = this.getModel().getProperty("/newOrder");
            
            var oModel = this.getModel("ordersModel");
            var aOrders = oModel.getProperty("/Orders");

            // Creiamo la riga finale da aggiungere, unendo i dati del form con dati tecnici (ID e Stato)
            var oOrderToPush = Object.assign({}, oNewOrderData, {
                OrderID: "ORD-" + Math.floor(Math.random() * 10000), // Genera ID casuale
                Status: "Created" // Impostiamo lo stato iniziale in inglese
            });

            // Aggiungiamo l'ordine in cima all'elenco
            aOrders.unshift(oOrderToPush);
            
            // Forziamo il refresh del modello per far apparire la riga in tabella
            oModel.refresh(true);

            // RESET DEL FORM: Puliamo i campi semplicemente svuotando il modello.
            // Gli input nella UI si svuoteranno istantaneamente da soli.
            this.getModel().setProperty("/newOrder", {
                CustomerName: "",
                Product: "",
                Category: "",
                Quantity: 1,
                UnitPrice: 0
            });

            this.onCancelOrder(); // Chiudiamo il popup
        },

        // ELIMINAZIONE ORDINE
        onDeleteOrder: function (oEvent) {
            // Identifichiamo il percorso dati della riga cliccata (es: "/Orders/5")
            var sPath = oEvent.getParameter("listItem").getBindingContext("ordersModel").getPath();
            var oModel = this.getModel("ordersModel");
            var aOrders = oModel.getProperty("/Orders");
            
            // Trasformiamo l'ultima parte del percorso in un numero (l'indice dell'array)
            var iIndex = parseInt(sPath.split("/").pop());

            // Rimuoviamo l'elemento dall'array JavaScript
            aOrders.splice(iIndex, 1);
            
            oModel.refresh(true);
            this._calculateTotal(); // Ricalcoliamo i totali perché un ordine è sparito
        }
    });
});