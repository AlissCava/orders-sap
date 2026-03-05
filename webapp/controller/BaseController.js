sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History",
  "sap/ui/model/json/JSONModel"
], function (Controller, History, JSONModel) {
  "use strict";

  // Definiamo il BaseController che estende il Controller standard di UI5
  return Controller.extend("orders.controller.BaseController", {

    // FUNZIONE getRouter: serve per navigare tra le pagine dell'app.
    // Invece di scrivere ogni volta "this.getOwnerComponent().getRouter()", useremo "this.getRouter()".
    getRouter: function () {
      return this.getOwnerComponent().getRouter();
    },

    // FUNZIONE getModel: permette di recuperare un modello dati (JSON o OData).
    // Controlla prima se il modello è nella Vista, altrimenti lo cerca nel Componente globale.
    getModel: function (sName) {
      return this.getView().getModel(sName) || this.getOwnerComponent().getModel(sName);
    },

    // FUNZIONE setModel: scorciatoia per assegnare un modello alla vista corrente.
    setModel: function (oModel, sName) {
      return this.getView().setModel(oModel, sName);
    },

    // FUNZIONE getResourceBundle: serve per leggere i testi dal file i18n tramite JavaScript.
    // Indispensabile per mostrare messaggi di errore o conferme tradotte.
    getResourceBundle: function () {
      return this.getOwnerComponent().getModel("i18n").getResourceBundle();
    },

    // FUNZIONE onNavBack: gestisce il tasto "Indietro" del browser o dell'app.
    // Se c'è una cronologia precedente, torna indietro, altrimenti riporta alla Home.
    onNavBack: function () {
      var oHistory = History.getInstance();
      var sPreviousHash = oHistory.getPreviousHash();

      if (sPreviousHash !== undefined) {
        window.history.go(-1); // Torna indietro di un passo nella cronologia
      } else {
        this.getRouter().navTo("Home", {}, true); // Torna alla Home se non c'è cronologia
      }
    }
  });
});