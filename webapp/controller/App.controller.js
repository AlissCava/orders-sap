sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function (Controller) {
  "use strict";

  return Controller.extend("orders.controller.App", {

    // 1. Funzione per aprire e chiudere il menu a comparsa
    onCollapseExpandPress: function () {
      var oToolPage = this.byId("toolPage");
      var bSideExpanded = oToolPage.getSideExpanded();

      // Inverte lo stato: se è aperto lo chiude, se è chiuso lo apre
      oToolPage.setSideExpanded(!bSideExpanded);
    },

    // 2. Funzione per navigare quando si clicca su una voce del menu
    onItemSelect: function (oEvent) {
      var oItem = oEvent.getParameter("item");
      var sKey = oItem.getKey(); // Legge se abbiamo cliccato "Home" o "Dashboard"

      // "Evoca" il navigatore satellitare (il Router)
      var oRouter = this.getOwnerComponent().getRouter();

      // Usa il Router per navigare verso la destinazione corretta
      if (sKey === "Home") {
        oRouter.navTo("RouteHome");
      } else if (sKey === "Dashboard") {
        oRouter.navTo("RouteDashboard");
      }
    }
  });
});