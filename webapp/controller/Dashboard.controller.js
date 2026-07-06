sap.ui.define([
    "orders/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (BaseController, JSONModel, MessageToast) {
    "use strict";

    return BaseController.extend("orders.controller.Dashboard", {

        onInit: function () {
            this.getRouter().getRoute("RouteDashboard").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function () {
            sap.ui.core.BusyIndicator.show(0); 

            try {
                // CHIAMATA AL BACKEND
                const oData = await this.odataRead("/ZES_lista_ordiniSet");

                sap.ui.core.BusyIndicator.hide();

                const aOrders = oData.results;

                const oStatusCounts = {};
                const oCustomerCounts = {}; 

                // Variabili per calcolare le nostre mattonelle KPI
                let fTotalRevenue = 0;
                let iPendingOrders = 0;

                // Contiamo i dati ciclando gli ordini
                aOrders.forEach(function (oOrder) {
                    const sStatus = oOrder.StatoTxt || "Nuovo";
                    const sCustomer = oOrder.Cliente || "Sconosciuto";

                    // 1. Dati per i grafici
                    oStatusCounts[sStatus] = (oStatusCounts[sStatus] || 0) + 1;
                    oCustomerCounts[sCustomer] = (oCustomerCounts[sCustomer] || 0) + 1;

                    // 2. Dati per le Mattonelle KPI
                    // Calcolo Fatturato blindato usando il campo corretto "ImportoTot"
                    const sValore = oOrder.ImportoTot ? oOrder.ImportoTot.toString().replace(',', '.') : "0";
                    const fImporto = parseFloat(sValore) || 0; 
                    fTotalRevenue += fImporto;

                    // Calcolo Ordini in Attesa (Contiamo quelli non ancora chiusi/completati)
                    if (sStatus === "Creato" || sStatus === "Nuovo" || sStatus === "In elaborazione") {
                        iPendingOrders++;
                    }
                });

                // Formattiamo il fatturato per farlo bello stile "K" (es. 6.1K) se supera i 1000 euro
                const sRevenueFormatted = fTotalRevenue > 1000 
                    ? (fTotalRevenue / 1000).toFixed(1) + "K" 
                    : fTotalRevenue.toFixed(2);

                // --- MODELLO MATTONELLE KPI ---
                const oDashboardData = {
                    totalOrders: aOrders.length, // Il numero totale degli ordini
                    totalRevenue: sRevenueFormatted,
                    pendingOrders: iPendingOrders
                };
                this.setModel(new JSONModel(oDashboardData), "dashboardModel");

                // --- MODELLO GRAFICI ---
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

                const oStatsModel = new JSONModel({
                    Statuses: aStatusStats,
                    Customers: aCustomerStats 
                });
                this.setModel(oStatsModel, "statsModel");

            } catch (oError) {
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show("Errore nel caricamento dei dati dal server SAP.");
            }
        }
    });
});