sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel" // Strumento per creare il nostro mini-database locale per i grafici
], function (Controller, JSONModel) {
  "use strict";

  return Controller.extend("orders.controller.Dashboard", {

    // ------------------------------------------------------------------------
    // 1. INIZIALIZZAZIONE DELLA PAGINA
    // ------------------------------------------------------------------------
    // Questa funzione scatta una sola volta quando l'applicazione viene caricata dal browser
    onInit: function () {
      // "Evochiamo" il navigatore satellitare dell'app (il Router)
      var oRouter = this.getOwnerComponent().getRouter();

      // Diciamo al Router: "Mettiti in ascolto. Quando l'utente clicca sul menu e 
      // atterra fisicamente sulla rotta 'RouteDashboard', fai partire la funzione _onRouteMatched".
      // Questo è fondamentale perché i grafici devono aggiornarsi ogni volta che entri,
      // nel caso l'utente abbia appena aggiunto o cancellato un ordine nella Home!
      oRouter.getRoute("RouteDashboard").attachPatternMatched(this._onRouteMatched, this);
    },

    // ------------------------------------------------------------------------
    // 2. IL MOTORE DI CALCOLO (Svegliato ogni volta che apriamo la Dashboard)
    // ------------------------------------------------------------------------
    _onRouteMatched: function () {

      // --- FASE A: Recupero Dati ---
      // Andiamo a bussare alla "cassaforte" dell'app per farci dare il modello globale degli ordini
      var oOrdersModel = this.getOwnerComponent().getModel("ordersModel");

      // Estraiamo l'array puro con tutte le righe degli ordini
      var aOrders = oOrdersModel.getProperty("/Orders");

      // Sistema di sicurezza: se il file JSON non si è caricato o è vuoto, blocca tutto
      // per evitare che l'app vada in crash con uno schermo bianco.
      if (!aOrders) {
        return;
      }

      // --- FASE B: I Due Pallottolieri ---
      // Creiamo due oggetti vuoti. Funzioneranno come dei veri e propri contatori.
      // Uno conterà quanti ordini ci sono per ogni Stato, l'altro per ogni Categoria.
      var oConteggiStato = {};
      var oConteggiCategoria = {};

      // Iniziamo il ciclo: passiamo in rassegna ogni singolo ordine presente nel database
      for (var i = 0; i < aOrders.length; i++) {

        // Leggiamo i valori della riga corrente
        var sStato = aOrders[i].Status;

        // Se un ordine vecchio (creato prima di aggiungere la colonna) non ha la Categoria, 
        // usiamo "Altro" come paracadute di sicurezza.
        var sCategoria = aOrders[i].Category || "Altro";

        // --- AGGIORNAMENTO PALLOTTOLIERE 1 (Gli Stati per la Ciambella) ---
        // Se questo stato (es. "Completato") non esiste ancora nel contatore, lo creiamo partendo da zero
        if (!oConteggiStato[sStato]) {
          oConteggiStato[sStato] = 0;
        }
        // Aggiungiamo 1 al contatore di questo specifico stato
        oConteggiStato[sStato]++;


        // --- AGGIORNAMENTO PALLOTTOLIERE 2 (Le Categorie per le Barre) ---
        // Facciamo la stessa identica cosa, ma per la categoria (es. "Hardware")
        if (!oConteggiCategoria[sCategoria]) {
          oConteggiCategoria[sCategoria] = 0;
        }
        oConteggiCategoria[sCategoria]++;
      }

      // --- FASE C: Preparazione per i Grafici ---
      // I grafici di SAPUI5 (MicroChart) sono schizzinosi: non accettano gli oggetti grezzi che abbiamo
      // appena usato come pallottolieri, ma vogliono degli Array ben formattati. Dobbiamo tradurli.

      // 1. Prepariamo l'array per la Ciambella
      var aStatisticheStato = [];
      for (var chiaveStato in oConteggiStato) {
        aStatisticheStato.push({
          label: chiaveStato,               // Es: "Completato"
          value: oConteggiStato[chiaveStato] // Es: 3
        });
      }

      // 2. Prepariamo l'array per le Barre
      var aStatisticheCategoria = [];
      for (var chiaveCategoria in oConteggiCategoria) {
        aStatisticheCategoria.push({
          label: chiaveCategoria,                  // Es: "Hardware"
          value: oConteggiCategoria[chiaveCategoria] // Es: 5
        });
      }

      // --- FASE D: Iniezione nella View ---
      // Mettiamo i due array tradotti dentro un nuovo "mini-database" creato appositamente per questa pagina.
      // Lo chiamiamo oStatsModel e gli diamo due "cartelle": Statuses e Categories.
      var oStatsModel = new JSONModel({
        Statuses: aStatisticheStato,
        Categories: aStatisticheCategoria
      });

      // Infine, colleghiamo fisicamente questo modello alla pagina Dashboard dandogli il nome "statsModel".
      // Così i grafici nell'XML potranno pescare i dati scrivendo "{statsModel>/Statuses}" ecc.
      this.getView().setModel(oStatsModel, "statsModel");
    }
  });
});