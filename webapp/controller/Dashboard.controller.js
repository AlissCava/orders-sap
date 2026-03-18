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
            const oModel = this.getModel(); 
            const that = this;

            sap.ui.core.BusyIndicator.show(0); // Accendiamo il caricamento

            // CHIAMATA AL BACKEND: "Ehi SAP, dammi tutti gli ordini per fare le statistiche!"
            oModel.read("/ZES_lista_ordiniSet", {
                success: function (oData) {
                    sap.ui.core.BusyIndicator.hide();
                    
                    // oData.results contiene l'array dei veri ordini dal server
                    const aOrders = oData.results; 

                    const oStatusCounts = {};
                    const oCustomerCounts = {}; // Sostituiamo Categoria con Cliente

                    // Contiamo i dati
                    aOrders.forEach(function (oOrder) {
                        const sStatus = oOrder.StatoTxt || "Nuovo";
                        const sCustomer = oOrder.Cliente || "Sconosciuto";

                        oStatusCounts[sStatus] = (oStatusCounts[sStatus] || 0) + 1;
                        oCustomerCounts[sCustomer] = (oCustomerCounts[sCustomer] || 0) + 1;
                    });

                    // Trasformiamo i conteggi in array per i grafici
                    const aStatusStats = Object.keys(oStatusCounts).map(function(sKey) {
                        return { label: sKey, value: oStatusCounts[sKey] };
                    });

                    const aCustomerStats = Object.keys(oCustomerCounts).map(function(sKey) {
                        return { label: sKey, value: oCustomerCounts[sKey] };
                    });

                    // Creiamo il modello locale per la vista
                    const oStatsModel = new JSONModel({
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