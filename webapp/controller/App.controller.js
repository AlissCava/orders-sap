sap.ui.define([
    "orders/controller/BaseController"
], function (BaseController) {
    "use strict";

    return BaseController.extend("orders.controller.App", {

        onInit: function () {
            // ho rimosso getContentDensityClass per evitare l'errore bloccante.
            // L'app funzionerà benissimo anche senza questa classe di densità.
        },

        onCollapseExpandPress: function () {
            const oToolPage = this.byId("toolPage");
            const bSideExpanded = oToolPage.getSideExpanded();
            
            oToolPage.setSideExpanded(!bSideExpanded);
        },

        onItemSelect: function (oEvent) {
            const oItem = oEvent.getParameter("item");
            
            this.getRouter().navTo(oItem.getKey());
        }
    });
});