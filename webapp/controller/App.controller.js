sap.ui.define([
    "orders/controller/BaseController" // Estendiamo le fondamenta comuni
], function (BaseController) {
    "use strict";

    return BaseController.extend("orders.controller.App", {
        // FUNZIONE onInit: scatta all'avvio dell'applicazione.
        onInit: function () {
            // Applichiamo la classe di densità dei contenuti (compatta o accogliente) 
            // per rendere l'interfaccia coerente con il resto dell'ecosistema SAP Fiori.
            this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
        },

        // FUNZIONE onCollapseExpandPress: gestisce l'apertura/chiusura del menu laterale.
        onCollapseExpandPress: function () {
            var oToolPage = this.byId("toolPage"); // Cerchiamo l'oggetto ToolPage tramite ID
            var bSideExpanded = oToolPage.getSideExpanded(); // Verifichiamo se il menu è aperto o chiuso

            // Se è aperto lo chiude, se è chiuso lo apre.
            oToolPage.setSideExpanded(!bSideExpanded);
        },

        // FUNZIONE onItemSelect: gestisce la navigazione quando clicchi sulle icone del menu.
        onItemSelect: function (oEvent) {
            var oItem = oEvent.getParameter("item"); // Capisce quale voce è stata cliccata
            // Usa il getRouter() definito nel BaseController per cambiare pagina.
            this.getRouter().navTo(oItem.getKey());
        }
    });
});