sap.ui.define([
  "orders/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (BaseController, JSONModel, MessageBox, MessageToast, Filter, FilterOperator) {
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
      // Leggiamo l'ID passato nell'URL (es: "new" oppure "4")
      const sObjectId = oEvent.getParameter("arguments").objectId;

      // Creiamo un modello (viewModel) per controllare l'interfaccia (es. Titolo pagina)
      const bIsNew = (sObjectId === "new");
      const oViewModel = new JSONModel({
        isNew: bIsNew,
        viewTitle: bIsNew ? "New Order" : "Edit Order " + sObjectId
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
      // I nomi delle proprietà restano quelli del backend SAP per non rompere i collegamenti XML
      const oEmptyOrder = {
        NumOrdine: "Auto-generated",
        Cliente: "",
        StatoTxt: "New",
        ImportoTot: 0,
        Articoli: [] // Tabella articoli inizialmente vuota
      };

      const oFormModel = new JSONModel(oEmptyOrder);
      this.setModel(oFormModel, "formModel");
    },

    _loadOrderData: function (sOrderId) {
      const oODataModel = this.getOwnerComponent().getModel();
      const that = this;

      sap.ui.core.BusyIndicator.show(0);

      // Per sicurezza, trasformiamo l'ID in numero puro per i filtri
      const iOrderId = parseInt(sOrderId, 10);

      // 1. PRIMA CHIAMATA: Leggiamo la testata usando un FILTRO (per aggirare il blocco "addressable=false")
      oODataModel.read("/ZES_lista_ordiniSet", {
        filters: [new sap.ui.model.Filter("NumOrdine", sap.ui.model.FilterOperator.EQ, iOrderId)],
        success: function (oHeaderResult) {

          // Siccome abbiamo chiesto una "lista" filtrata, il risultato è un array.
          // Controlliamo che abbia trovato almeno un ordine e prendiamo il primo (e unico)
          if (!oHeaderResult.results || oHeaderResult.results.length === 0) {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageBox.error("Order not found on server.");
            return;
          }

          const oHeaderData = oHeaderResult.results[0];

          // Trasformiamo i dati della testata per il nostro form
          const oOrderData = {
            NumOrdine: oHeaderData.NumOrdine,
            Cliente: oHeaderData.Cliente,
            StatoTxt: oHeaderData.StatoTxt,
            ImportoTot: oHeaderData.ImportoTot,
            Articoli: [] // Inizialmente vuoto
          };

          // 2. SECONDA CHIAMATA: Leggiamo gli Articoli di questo ordine con un altro filtro
          oODataModel.read("/ZES_dettagli_ordiniSet", {
            filters: [new sap.ui.model.Filter("NumOrdine", sap.ui.model.FilterOperator.EQ, iOrderId)],
            success: function (oItemsData) {
              sap.ui.core.BusyIndicator.hide();

              // Aggiungiamo gli articoli recuperati ai dati dell'ordine
              oOrderData.Articoli = oItemsData.results || [];

              // Infine, passiamo tutto alla View
              const oFormModel = new sap.ui.model.json.JSONModel(oOrderData);
              that.setModel(oFormModel, "formModel");
            },
            error: function () {
              sap.ui.core.BusyIndicator.hide();
              sap.m.MessageBox.warning("Order header loaded, but failed to load items.");

              // Mostriamo comunque la testata anche se gli articoli falliscono
              const oFormModel = new sap.ui.model.json.JSONModel(oOrderData);
              that.setModel(oFormModel, "formModel");
            }
          });

        },
        error: function () {
          sap.ui.core.BusyIndicator.hide();
          sap.m.MessageBox.error("The server rejected the header request.");
        }
      });
    },
    // ------------------------------------------------------------------------
    // 3. AZIONI DELLA PAGINA (Aggiungi Riga, Salva, Annulla)
    // ------------------------------------------------------------------------

    // Funzione per il tasto "+" nella tabella articoli
    onAddArticleToOrder: function () {
      const oFormModel = this.getModel("formModel");
      const aArticles = oFormModel.getProperty("/Articoli");

      // Aggiungiamo una riga vuota all'array
      aArticles.push({
        CodArticolo: "",
        NomeArticolo: "",
        QuantitaOrdine: 1,
        Importo: 0
      });

      // Aggiorniamo il modello (la tabella si aggiornerà da sola!)
      oFormModel.setProperty("/Articoli", aArticles);
    },

    onSave: function () {
      // Placeholder temporaneo in attesa della logica di salvataggio definitiva
      MessageToast.show("Data ready to be saved!");
    },

    onCancel: function () {
      // Torniamo semplicemente indietro senza salvare
      this.onNavBack();
    }
  });
});