sap.ui.define([
    "orders/controller/BaseController", // Usiamo il BaseController per modelli e router
    "sap/ui/model/json/JSONModel"
], function (BaseController, JSONModel) {
    "use strict";

    return BaseController.extend("orders.controller.Dashboard", {

        onInit: function () {
            // Otteniamo il router dal BaseController e ascoltiamo l'ingresso sulla Dashboard.
            // È importante ricalcolare i dati ogni volta che l'utente entra nella pagina.
            this.getRouter().getRoute("Dashboard").attachPatternMatched(this._onRouteMatched, this);
        },

        // MOTORE DI CALCOLO DELLE STATISTICHE
        _onRouteMatched: function () {
            // Recuperiamo il modello globale degli ordini tramite il BaseController.
            var oOrdersModel = this.getModel("ordersModel");
            var aOrders = oOrdersModel.getProperty("/Orders");

            // Controllo di sicurezza: se non ci sono ordini, non procedere.
            if (!aOrders) {
                return;
            }

            // Inizializziamo i contatori (pallottolieri) per stato e categoria.
            var oStatusCounts = {};
            var oCategoryCounts = {};

            // Cicliamo l'intero array degli ordini.
            aOrders.forEach(function (oOrder) {
                var sStatus = oOrder.Status;
                var sCategory = oOrder.Category || "Other"; // Usiamo "Other" (inglese) come fallback

                // Contiamo gli ordini per ogni Stato (es: "Created", "In Progress").
                oStatusCounts[sStatus] = (oStatusCounts[sStatus] || 0) + 1;

                // Contiamo gli ordini per ogni Categoria (es: "Hardware", "Software").
                oCategoryCounts[sCategory] = (oCategoryCounts[sCategory] || 0) + 1;
            });

            // TRADUZIONE DATI PER I GRAFICI:
            // I MicroCharts di SAPUI5 richiedono degli array. Trasformiamo i nostri oggetti contatori.
            var aStatusStats = Object.keys(oStatusCounts).map(function(sKey) {
                return { label: sKey, value: oStatusCounts[sKey] };
            });

            var aCategoryStats = Object.keys(oCategoryCounts).map(function(sKey) {
                return { label: sKey, value: oCategoryCounts[sKey] };
            });

            // Creiamo un modello JSON locale specifico per la Dashboard.
            var oStatsModel = new JSONModel({
                Statuses: aStatusStats,
                Categories: aCategoryStats
            });

            // Assegniamo il modello alla vista tramite la funzione del BaseController.
            this.setModel(oStatsModel, "statsModel");
        }
    });
});