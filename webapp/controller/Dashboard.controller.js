sap.ui.define([
    "orders/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast" // Aggiunto per il messaggio di errore
], function (BaseController, JSONModel, MessageToast) {
    "use strict";

    return BaseController.extend("orders.controller.Dashboard", {

        onInit: function () {
            this.getRouter().getRoute("RouteDashboard").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function () {
            sap.ui.core.BusyIndicator.show(0); // Accendiamo il caricamento

            try {
                // CHIAMATA AL BACKEND: "Ehi SAP, dammi tutti gli ordini per fare le statistiche!"
                // Usiamo await per attendere la Promise dal BaseController
                const oData = await this.odataRead("/ZES_lista_ordiniSet");

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
                const aStatusStats = Object.keys(oStatusCounts).map(function (sKey) {
                    return { 
                        label: sKey, 
                        value: oStatusCounts[sKey],
                        displayValue: oStatusCounts[sKey].toString() 
                    };
                });

                const aCustomerStats = Object.keys(oCustomerCounts).map(function (sKey) {
                    return { label: sKey, value: oCustomerCounts[sKey] };
                });

                // Creiamo il modello locale per la vista
                const oStatsModel = new JSONModel({
                    Statuses: aStatusStats,
                    Customers: aCustomerStats // Nuova property per i Clienti
                });

                // Possiamo usare "this" direttamente perché siamo in una funzione async (non serve più that)
                this.setModel(oStatsModel, "statsModel");

            } catch (oError) {
                sap.ui.core.BusyIndicator.hide();
                // Gestione dell'errore (puoi usare la tua funzione handleBackendError se vuoi un log più dettagliato)
                MessageToast.show("Errore nel caricamento dei dati dal server SAP.");
            }

            this.setInitialFocus("inputCliente");
        }
    });
});