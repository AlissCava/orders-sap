sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("orders.controller.Home", {

        onInit: function () {
            // Qui metteremo codice in futuro, se serve all'avvio
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
        }

    });
});