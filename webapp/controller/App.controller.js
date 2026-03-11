sap.ui.define([
    "orders/controller/BaseController"
], function (BaseController) {
    "use strict";

    return BaseController.extend("orders.controller.App", {

        onInit: function () {
            // Abbiamo rimosso getContentDensityClass per evitare l'errore bloccante.
            // L'app funzionerà benissimo anche senza questa classe di densità.
        },

        onCollapseExpandPress: function () {
            var oToolPage = this.byId("toolPage");
            var bSideExpanded = oToolPage.getSideExpanded();
            oToolPage.setSideExpanded(!bSideExpanded);
        },

        onItemSelect: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            this.getRouter().navTo(oItem.getKey());
        }
    });
});