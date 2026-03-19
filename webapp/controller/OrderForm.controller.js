sap.ui.define([
  "orders/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (BaseController, JSONModel, MessageBox, MessageToast) {
  "use strict";

  return BaseController.extend("orders.controller.OrderForm", {

    // ------------------------------------------------------------------------
    // 1. INIZIALIZZAZIONE E ROUTING
    // ------------------------------------------------------------------------
    onInit: function () {
      // Quando scatta "RouteOrderForm", chiama la funzione _onRouteMatched
      this.getRouter().getRoute("RouteOrderForm").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      // Leggiamo l'ID passato nell'URL (es: "new" oppure "1024")
      const sObjectId = oEvent.getParameter("arguments").objectId;

      // Creiamo un modello (viewModel) per controllare l'interfaccia (es. Titolo pagina)
      const bIsNew = (sObjectId === "new");
      const oViewModel = new JSONModel({
        isNew: bIsNew,
        viewTitle: bIsNew ? "Nuovo Ordine" : "Modifica Ordine " + sObjectId
      });
      this.setModel(oViewModel, "viewModel");

      // Decidiamo cosa fare con i dati in base all'ID
      if (bIsNew) {
        this._createEmptyForm(); // Modalità CREAZIONE
      } else {
        this._loadOrderData(sObjectId); // Modalità MODIFICA
      }
    },

    // ------------------------------------------------------------------------
    // 2. GESTIONE DATI (NUOVO vs ESISTENTE)
    // ------------------------------------------------------------------------
    _createEmptyForm: function () {
      // Prepariamo un "guscio vuoto" per il nuovo ordine
      const oEmptyOrder = {
        NumOrdine: "Auto-generato",
        Cliente: "",
        StatoTxt: "Nuovo",
        ImportoTot: 0,
        Articoli: [] // Tabella articoli inizialmente vuota
      };

      const oFormModel = new JSONModel(oEmptyOrder);
      this.setModel(oFormModel, "formModel");
    },

    _loadOrderData: function (sOrderId) {
      // Prendiamo il modello OData direttamente dal "cervello" centrale dell'app
      const oODataModel = this.getOwnerComponent().getModel();
      const that = this;

      sap.ui.core.BusyIndicator.show(0);

      // 1. COSTRUIAMO L'URL A MANO (Bypassiamo createKey che ci blocca)
      // Di solito in SAP le chiavi, anche se composte da numeri, viaggiano come stringhe ('4')
      let sPath = "/ZES_lista_ordiniSet('" + sOrderId + "')";

      // 2. CHIEDIAMO I DATI A SAP
      oODataModel.read(sPath, {
        urlParameters: {
          "$expand": "ZET_dettagli_ordiniSet"
        },
        success: function (oData) {
          sap.ui.core.BusyIndicator.hide();

          // Trasformiamo i dati per il nostro form
          const oOrderData = {
            NumOrdine: oData.NumOrdine,
            Cliente: oData.Cliente,
            StatoTxt: oData.StatoTxt,
            ImportoTot: oData.ImportoTot,
            // Estraiamo l'array degli articoli
            Articoli: oData.ZET_dettagli_ordiniSet ? oData.ZET_dettagli_ordiniSet.results : []
          };

          const oFormModel = new JSONModel(oOrderData);
          that.setModel(oFormModel, "formModel");
        },
        error: function (oError) {
          sap.ui.core.BusyIndicator.hide();

          // Stampiamo l'errore tecnico per capire se SAP voleva il numero senza apici
          MessageBox.error("Il server ha rifiutato la richiesta. Controlla la console F12.");
          console.error("Dettaglio errore:", oError);
        }
      });
    },

    // ------------------------------------------------------------------------
    // 3. AZIONI DELLA PAGINA (Aggiungi Riga, Salva, Annulla)
    // ------------------------------------------------------------------------

    // Funzione per il tasto "+" nella tabella articoli
    onAddArticleToOrder: function () {
      const oFormModel = this.getModel("formModel");
      const aArticoli = oFormModel.getProperty("/Articoli");

      // Aggiungiamo una riga vuota all'array
      aArticoli.push({
        CodArticolo: "",
        NomeArticolo: "",
        QuantitaOrdine: 1,
        Importo: 0
      });

      // Aggiorniamo il modello (la tabella si aggiornerà da sola!)
      oFormModel.setProperty("/Articoli", aArticoli);
    },

    onSave: function () {
      // Per ora mettiamo un avviso. La logica di salvataggio (Deep Insert o Update) 
      // la scriveremo non appena testiamo che l'interfaccia funzioni!
      MessageToast.show("Dati pronti per il salvataggio!");
    },

    onCancel: function () {
      // Torniamo semplicemente indietro senza salvare
      this.onNavBack();
    }
  });
});