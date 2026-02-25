sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
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
            // Prendiamo il modello dati e la lista degli ordini
            var oModel = this.getView().getModel("ordersModel");
            var aOrders = oModel.getProperty("/Orders");

            var fTotal = 0; // Partiamo da zero

            // Se ci sono degli ordini, facciamo un ciclo (loop) su tutti
            if (aOrders) {
                for (var i = 0; i < aOrders.length; i++) {
                    // Moltiplichiamo il prezzo per la quantità e lo aggiungiamo al totale
                    fTotal += (aOrders[i].UnitPrice * aOrders[i].Quantity);
                }
            }

            // Andiamo a prendere il Titolo in cima alla tabella tramite il suo ID
            var oTitle = this.byId("titoloTotale");

            // Se il titolo esiste, aggiorniamo il suo testo con il numero formattato (2 decimali)
            if (oTitle) {
                oTitle.setText("Totale: " + fTotal.toFixed(2) + " €");
            }
        },

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

        //Facciamo funzionare il bottone e il pop-up
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