sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/export/Spreadsheet",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, Spreadsheet, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("orders.controller.Home", {

        onInit: function () {
            // Qui metteremo codice in futuro, se serve all'avvio
        },

        //Matematica degli ordini totali
        // 1. Questa funzione scatta ogni volta che la tabella si aggiorna (aggiunte, rimozioni, caricamento iniziale)
        onTableUpdateFinished: function () {
            this._calculateTotal();
        },

        // 2. Il "Ragioniere": calcola fisicamente il totale
        _calculateTotal: function () {
            // 1. Recuperiamo il modello dati e la lista completa degli ordini
            var oModel = this.getView().getModel("ordersModel");
            var aOrders = oModel.getProperty("/Orders");

            // 2. Prepariamo i nostri contatori partendo da zero
            var iOrdiniValidi = 0; // Conta solo gli ordini reali (esclude i cancellati)
            var iPezzi = 0;        // Conta la quantità totale di articoli
            var fValore = 0;       // Conta il fatturato totale in Euro

            // 3. Controlliamo che la lista ordini esista (per evitare errori se è vuota)
            if (aOrders) {

                // Facciamo un ciclo (loop) passando in rassegna ogni singolo ordine
                for (var i = 0; i < aOrders.length; i++) {

                    // 4. IL FILTRO: Consideriamo solo gli ordini che NON sono "Cancellati"
                    // In JavaScript il simbolo !== significa "diverso da"
                    if (aOrders[i].Status !== "Cancellato") {

                        // Aggiorniamo i contatori solo per gli ordini validi
                        iOrdiniValidi++; // Aggiunge 1 al numero di ordini

                        iPezzi += aOrders[i].Quantity; // Somma le quantità fisiche

                        fValore += (aOrders[i].UnitPrice * aOrders[i].Quantity); // Somma i soldi

                    }
                }
            }

            // 5. Andiamo a cercare i tre contenitori nell'interfaccia usando i loro ID
            var oTxtOrdini = this.byId("txtTotaleOrdini");
            var oTxtPezzi = this.byId("txtPezziVenduti");
            var oNumValore = this.byId("numValoreTotale");

            // 6. Inseriamo i risultati calcolati dentro l'interfaccia visiva
            if (oTxtOrdini) {
                oTxtOrdini.setText(iOrdiniValidi);
            }
            if (oTxtPezzi) {
                oTxtPezzi.setText(iPezzi);
            }
            if (oNumValore) {
                // toFixed(2) formatta il numero forzando sempre due decimali (es. 150.00)
                oNumValore.setNumber(fValore.toFixed(2));
            }
        },

        // Funzione per esportare i dati della tabella in un file Excel
        onExport: function () {

            // 1. Definiamo quali colonne vogliamo nel file Excel e a quali dati corrispondono
            // La "label" è il titolo della colonna su Excel, la "property" è il nome esatto nel JSON
            var aCols = [
                { label: "ID Ordine", property: "OrderID" },
                { label: "Cliente", property: "CustomerName" },
                { label: "Prodotto", property: "Product" },
                { label: "Quantità", property: "Quantity" },
                { label: "Prezzo Unitario (€)", property: "UnitPrice" },
                { label: "Stato", property: "Status" },
                { label: "Data Ordine", property: "OrderDate" }
            ];

            // 2. Recuperiamo l'intera lista degli ordini dal nostro modello dati
            var oModel = this.getView().getModel("ordersModel");
            var aOrders = oModel.getProperty("/Orders");

            // 3. Creiamo le "Istruzioni di montaggio" per il file Excel
            var oSettings = {
                workbook: { columns: aCols }, // Diciamo quali colonne usare
                dataSource: aOrders,          // Passiamo i dati da inserire
                fileName: "Elenco_Ordini_SAP.xlsx" // Diamo un nome al file scaricato
            };

            // 4. Creiamo materialmente il file e forziamo il download
            var oSheet = new Spreadsheet(oSettings);

            oSheet.build().finally(function () {
                // Puliamo la memoria dell'applicazione una volta finito il download
                oSheet.destroy();
            });
        },

        // Funzione che scatta ogni volta che scriviamo o cancelliamo qualcosa nella barra di ricerca
        onSearch: function (oEvent) {

            // 1. Leggiamo il testo esatto digitato dall'utente
            var sQuery = oEvent.getParameter("newValue");

            // 2. Prepariamo una scatola vuota per contenere i nostri criteri di ricerca
            var aFilters = [];

            // 3. Se l'utente ha scritto qualcosa, costruiamo i filtri
            if (sQuery && sQuery.length > 0) {

                // Creiamo un filtro per la colonna "CustomerName" (Cliente)
                var filterCustomer = new Filter("CustomerName", FilterOperator.Contains, sQuery);

                // Creiamo un filtro per la colonna "Product" (Prodotto)
                var filterProduct = new Filter("Product", FilterOperator.Contains, sQuery);

                // Uniamo i due filtri per dire al sistema: "Cerca nel Cliente OPPURE nel Prodotto"
                var combinedFilter = new Filter({
                    filters: [filterCustomer, filterProduct],
                    and: false // 'false' significa OR (oppure)
                });

                // Inseriamo il filtro combinato nella nostra scatola
                aFilters.push(combinedFilter);
            }

            // 4. Andiamo a prendere la tabella tramite il suo ID
            var oTable = this.byId("ordersTable");

            // 5. Prendiamo l'elenco delle righe (items) generate dal Data Binding
            var oBinding = oTable.getBinding("items");

            // 6. Applichiamo il filtro! Le righe che non corrispondono verranno nascoste all'istante
            oBinding.filter(aFilters);
        },

        //Elimina un ordine
        onDeleteOrder: function (oEvent) {
            // 1. Capire quale riga è stata cliccata (Il famoso Binding Context!)
            var oItem = oEvent.getParameter("listItem");
            var sPath = oItem.getBindingContext("ordersModel").getPath();

            // 2. Recuperare il modello e i dati completi
            var oModel = this.getView().getModel("ordersModel");
            var oData = oModel.getData();

            // 3. Estrarre il numero esatto della riga (l'indice) dal percorso
            var sIndex = sPath.split("/").pop();

            // 4. Rimuovere l'ordine dall'array usando la funzione splice di JavaScript
            oData.Orders.splice(sIndex, 1);

            // 5. Aggiornare il modello per far sparire la riga dallo schermo in automatico
            oModel.refresh(true);
        },

        //Facciamo funzionare il bottone e il pop-up per creare un ordine nuovo
        // 1. Apre il Pop-up quando clicchi "Nuovo Ordine"
        onOpenAddDialog: function () {
            this.byId("addOrderDialog").open();
        },

        // 2. Chiude il Pop-up se ci ripensi
        onCancelOrder: function () {
            this.byId("addOrderDialog").close();
        },

        // 3. Salva i dati e crea la nuova riga nella tabella
        onSaveOrder: function () {
            // Raccogliamo i valori scritti dall'utente usando i loro ID
            var sCustomer = this.byId("inputCustomer").getValue();
            var sProduct = this.byId("inputProduct").getValue();
            var sQuantity = this.byId("inputQuantity").getValue();
            var sPrice = this.byId("inputPrice").getValue();

            // Creiamo un nuovo oggetto "Ordine" strutturato come il nostro JSON
            var oNewOrder = {
                OrderID: "ORD-" + Math.floor(Math.random() * 10000), // Genera un ID finto a caso
                CustomerName: sCustomer,
                Product: sProduct,
                Quantity: parseInt(sQuantity, 10), // Assicura che sia un numero intero
                UnitPrice: parseFloat(sPrice),     // Assicura che sia un numero decimale
                Status: "Nuovo",                   // Stato di default
                OrderDate: new Date().toISOString().split("T")[0] // Inserisce la data di oggi
            };

            // Prendiamo il Modello e l'array degli ordini
            var oModel = this.getView().getModel("ordersModel");
            var oData = oModel.getData();

            // Aggiungiamo il nuovo ordine in cima alla lista (unshift)
            oData.Orders.unshift(oNewOrder);

            // Refreshamo il modello per far apparire la riga in tabella
            oModel.refresh(true);

            // Puliamo i campi per la prossima volta che apriremo il popup
            this.byId("inputCustomer").setValue("");
            this.byId("inputProduct").setValue("");
            this.byId("inputQuantity").setValue("");
            this.byId("inputPrice").setValue("");

            // Chiudiamo il Pop-up
            this.byId("addOrderDialog").close();
        }

    });
});