sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox" // Aggiunto MessageBox per poter mostrare i popup di errore centralizzati
], function (Controller, History, JSONModel, MessageBox) {
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

    // FUNZIONE getText: una comodissima scorciatoia. 
    // Invece di scrivere sempre "this.getResourceBundle().getText('chiave')", 
    // ora nei controller potremo scrivere semplicemente "this.getText('chiave')".
    getText: function (sKey) {
      return this.getResourceBundle().getText(sKey);
    },

    // FUNZIONE onNavBack: gestisce il tasto "Indietro" del browser o dell'app.
    // Se c'è una cronologia precedente, torna indietro, altrimenti riporta alla Home.
    onNavBack: function () {
      // Modificati da var a const perché i valori estratti non cambiano mai all'interno della funzione
      const oHistory = History.getInstance();
      const sPreviousHash = oHistory.getPreviousHash();

      if (sPreviousHash !== undefined) {
        window.history.go(-1); // Torna indietro di un passo nella cronologia
      } else {
        this.getRouter().navTo("Home", {}, true); // Torna alla Home se non c'è cronologia
      }
    },

    // ========================================================================
    // NUOVE FUNZIONI: OPERAZIONI CRUD GENERICHE (Wrapper asincroni con Promise)
    // 
    // COSA SONO LE PROMISE?
    // Quando chiediamo dei dati a SAP, la risposta non è immediata. 
    // Le Promise ci permettono di dire al codice: "Tu fai la richiesta, io ti prometto 
    // che aspetterò. Quando hai finito, se va tutto bene usa 'resolve' (risolto), 
    // se va male usa 'reject' (rifiutato)".
    // ========================================================================

    // ========================================================================
    // 1. LETTURA (GET) - Chiede i dati a SAP.
    // sPath: il nome della tabella (es. "/ZES_articoliSet")
    // oUrlParams: i parametri opzionali (es. $top=1 o $orderby)
    // ========================================================================
    odataRead: function (sPath, oUrlParams) {
      // Recuperiamo il modello OData. È il nostro "postino", l'oggetto che sa come parlare col server.
      const oModel = this.getModel(); 
      
      // Creiamo e restituiamo una nuova Promessa. Il codice che chiama questa funzione 
      // si metterà in "attesa" finché non chiamiamo resolve() o reject().
      return new Promise(function (resolve, reject) {
        
        // Diciamo al postino (oModel) di fare una chiamata di lettura (.read) verso la tabella (sPath)
        oModel.read(sPath, {
          
          // Passiamo i parametri extra (se ci sono). Ad esempio, per dire a SAP di ordinarli.
          urlParameters: oUrlParams, 
          
          // Questa funzione scatta in automatico SOLO se il server risponde "OK, ecco i dati"
          success: function (oData) { 
            // La chiamata è andata a buon fine! 
            // Usiamo 'resolve' per sbloccare il codice che stava aspettando e gli consegniamo i dati (oData).
            resolve(oData); 
          },
          
          // Questa funzione scatta in automatico SOLO se il server va in errore (es. connessione assente)
          error: function (oError) { 
            // Qualcosa è andato storto. 
            // Usiamo 'reject' per avvisare che la promessa è rotta, passando l'oggetto errore per capire cosa è successo.
            reject(oError); 
          }
        });
      });
    },

    // ========================================================================
    // 2. CREAZIONE (POST) - Invia un nuovo record al database SAP.
    // sPath: il nome della tabella in cui scrivere (es. "/ZES_articoliSet")
    // oPayload: l'oggetto JSON con i dati compilati dall'utente (es. Nome, Prezzo)
    // ========================================================================
    odataCreate: function (sPath, oPayload) {
      // Chiamiamo di nuovo il nostro postino
      const oModel = this.getModel();
      
      // Iniziamo un'altra Promessa di attesa asincrona
      return new Promise(function (resolve, reject) {
        
        // Usiamo il metodo .create nativo di SAPUI5. 
        // Gli passiamo la tabella di destinazione (sPath) e il "pacco" con i dati da salvare (oPayload).
        oModel.create(sPath, oPayload, {
          
          // Se SAP salva il record correttamente, entra qui
          success: function (oData) { 
            // SAP di solito ci restituisce il record appena creato (magari con l'ID definitivo).
            // Lo passiamo indietro usando resolve.
            resolve(oData); 
          },
          
          // Se SAP rifiuta il salvataggio (es. formato sbagliato o dati mancanti), entra qui
          error: function (oError) { 
            // Segnaliamo il fallimento passando l'errore
            reject(oError); 
          }
        });
      });
    },

    // ========================================================================
    // 3. AGGIORNAMENTO (PUT) - Modifica un record già esistente su SAP.
    // sPath: deve contenere la tabella E l'ID esatto del record, es. "/ZES_articoliSet('15')"
    // oPayload: i nuovi dati aggiornati da sovrascrivere
    // ========================================================================
    odataUpdate: function (sPath, oPayload) {
      const oModel = this.getModel();
      
      return new Promise(function (resolve, reject) {
        
        // Usiamo il metodo .update di SAPUI5 per dire "sovrascrivi questo record"
        oModel.update(sPath, oPayload, {
          
          // Se la modifica va a buon fine, entra qui
          success: function () { 
            // A differenza della create, l'update di SAP spesso non restituisce dati indietro.
            // Il server ci dice solo "Fatto". Quindi chiamiamo resolve() vuoto, senza passare variabili.
            resolve(); 
          },
          
          // Se c'è un errore (es. il record non esiste più), entra qui
          error: function (oError) { 
            // Segnaliamo l'errore
            reject(oError); 
          }
        });
      });
    },

    // ========================================================================
    // 4. ELIMINAZIONE (DELETE) - Cancella un record da SAP.
    // sPath: punta direttamente al record da eliminare, es. "/ZES_articoliSet('15')"
    // ========================================================================
    odataDelete: function (sPath) {
      const oModel = this.getModel();
      
      return new Promise(function (resolve, reject) {
        
        // Usiamo il metodo .remove di SAPUI5. 
        // Nota bene: non c'è un payload qui, perché per cancellare basta solo l'ID contenuto nel sPath.
        oModel.remove(sPath, {
          
          // Se SAP cancella il record con successo, entra qui
          success: function () { 
            // Cancellazione confermata, sblocchiamo il codice in attesa
            resolve(); 
          },
          
          // Se non si può cancellare (es. l'articolo è legato a un ordine in corso), entra qui
          error: function (oError) { 
            // Restituiamo il motivo per cui non si può cancellare
            reject(oError); 
          }
        });
      });
    },

    // ========================================================================
    // FUNZIONE GENERICA DI GESTIONE ERRORI
    // Questa funzione centralizza il modo in cui mostriamo i popup di errore rossi.
    // I messaggi di errore di SAP sono spesso nascosti dentro un formato JSON strano.
    // ========================================================================
    handleBackendError: function (oError) {
      // Partiamo dal presupposto peggiore: usiamo il messaggio generico "Errore di rete" preso dall'i18n
      let sMessage = this.getText("msgErrorBackend"); 
      
      // try...catch è un blocco di sicurezza. 
      // "Prova (try) a leggere il JSON dell'errore. Se il JSON è rotto e il codice esplode, 
      // non bloccare l'applicazione, ma cattura (catch) lo scoppio e ignoralo".
      try {
        // Se c'è un oggetto errore e contiene un "responseText" (la risposta testuale del server)
        if (oError && oError.responseText) {
          // Trasformiamo il testo in un oggetto Javascript navigabile
          const oResponse = JSON.parse(oError.responseText);
          
          // Scendiamo nell'albero della risposta per trovare il messaggio vero e proprio di SAP
          if (oResponse && oResponse.error && oResponse.error.message && oResponse.error.message.value) {
            // Trovato! Sostituiamo il messaggio generico con quello preciso che ci ha mandato il backend
            sMessage = oResponse.error.message.value;
          }
        }
      } catch (e) {
        // Se JSON.parse fallisce (perché la risposta non era in formato JSON),
        // non facciamo nulla. Rimarrà impostato il messaggio generico sMessage.
      }
      
      // Infine, mostriamo fisicamente il popup rosso sullo schermo con il messaggio finale
      MessageBox.error(sMessage);
    }

  });
});