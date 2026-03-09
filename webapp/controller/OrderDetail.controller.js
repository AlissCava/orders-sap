sap.ui.define([
    "orders/controller/BaseController"
], function (BaseController) {
    "use strict";

    return BaseController.extend("orders.controller.OrderDetail", {

        onInit: function () {
            // Agganciamo il router per intercettare quando l'utente entra in questa rotta
            this.getRouter().getRoute("RouteOrderDetail").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
            // Estraiamo l'ID dell'ordine passato nell'URL (es. "1001")
            var sOrderId = oEvent.getParameter("arguments").orderId;

            // Diciamo alla View di "agganciarsi" a questo specifico ordine nel backend OData.
            // L'opzione 'expand' ordina al backend: "Portami anche l'array degli articoli collegati"
            this.getView().bindElement({
                path: "/ZES_DeepOrdiniSet('" + sOrderId + "')",
                parameters: {
                    expand: "ZET_dettagli_ordiniSet"
                },
                events: {
                    dataRequested: function () {
                        // Accendiamo il caricamento mentre aspettiamo il server
                        sap.ui.core.BusyIndicator.show(0);
                    },
                    dataReceived: function () {
                        // Spegniamo il caricamento quando i dati arrivano
                        sap.ui.core.BusyIndicator.hide();
                    }
                }
            });
        }
    });
});