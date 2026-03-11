sap.ui.define([
    "orders/controller/BaseController",
    "sap/ui/model/json/JSONModel"
], function (BaseController, JSONModel) {
    "use strict";

    return BaseController.extend("orders.controller.Dashboard", {

        onInit: function () {
            this.getRouter().getRoute("RouteDashboard").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            // Prendiamo il modello OData REALE (senza nome)
            var oModel = this.getModel(); 
            var that = this;

            sap.ui.core.BusyIndicator.show(0); // Accendiamo il caricamento

            // CHIAMATA AL BACKEND: "Ehi SAP, dammi tutti gli ordini per fare le statistiche!"
            oModel.read("/ZES_lista_ordiniSet", {
                success: function (oData) {
                    sap.ui.core.BusyIndicator.hide();
                    
                    // oData.results contiene l'array dei veri ordini dal server
                    var aOrders = oData.results; 

                    var oStatusCounts = {};
                    var oCustomerCounts = {}; // Sostituiamo Categoria con Cliente

                    // Contiamo i dati
                    aOrders.forEach(function (oOrder) {
                        var sStatus = oOrder.StatoTxt || "Nuovo";
                        var sCustomer = oOrder.Cliente || "Sconosciuto";

                        oStatusCounts[sStatus] = (oStatusCounts[sStatus] || 0) + 1;
                        oCustomerCounts[sCustomer] = (oCustomerCounts[sCustomer] || 0) + 1;
                    });

                    // Trasformiamo i conteggi in array per i grafici
                    var aStatusStats = Object.keys(oStatusCounts).map(function(sKey) {
                        return { label: sKey, value: oStatusCounts[sKey] };
                    });

                    var aCustomerStats = Object.keys(oCustomerCounts).map(function(sKey) {
                        return { label: sKey, value: oCustomerCounts[sKey] };
                    });

                    // Creiamo il modello locale per la vista
                    var oStatsModel = new JSONModel({
                        Statuses: aStatusStats,
                        Customers: aCustomerStats // Nuova property per i Clienti
                    });

                    that.setModel(oStatsModel, "statsModel");
                },
                error: function () {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageToast.show("Errore nel caricamento dei dati dal server SAP.");
                }
            });
        }
    });
});