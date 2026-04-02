sap.ui.define([
    "orders/controller/BaseController", // Carica il controller padre con le funzioni comuni
    "sap/ui/model/json/JSONModel",      // Carica il costruttore per creare modelli dati locali
    "sap/m/MessageBox",                 // Carica il modulo per mostrare finestre di errore bloccanti
    "sap/m/MessageToast"                // Carica il modulo per piccoli messaggi di conferma a scomparsa
], function (BaseController, JSONModel, MessageBox, MessageToast) {
    "use strict"; // Attiva il controllo rigoroso del codice JS

    return BaseController.extend("orders.controller.ArticleForm", {

        // ========================================================================
        // 1. INIZIALIZZAZIONE E GESTIONE URL
        // ========================================================================
        onInit: function () {
            // Aggancia una funzione all'evento "patternMatched" della rotta 'RouteArticleForm'
            // Ogni volta che l'URL cambia e corrisponde a questa rotta, viene eseguito _onRouteMatched
            this.getRouter().getRoute("RouteArticleForm").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            // Recupera l'ID dell'oggetto passato nell'URL (es: "new" oppure "101")
            const sObjectId = oEvent.getParameter("arguments").objectId;
            
            // Verifica se stiamo creando un nuovo articolo (true se l'ID è "new")
            const bIsNew = (sObjectId === "new");
            
            // Crea un modello JSON locale per gestire lo stato della View (UI state)
            const oViewModel = new JSONModel({
                isNew: bIsNew, // Indica alla View se siamo in modalità creazione o modifica
                // Imposta il titolo della pagina recuperando la traduzione corretta dai file i18n
                viewTitle: bIsNew ? this.getText("dialogCreateArticleTitle") : this.getText("dialogEditArticleTitle")
            });
            
            // Assegna il modello alla View con il nome "viewModel"
            this.setModel(oViewModel, "viewModel");

            // Se l'ID è "new" inizializza un form vuoto, altrimenti carica i dati dal database
            if (bIsNew) {
                this._createEmptyForm(); // Logica per nuovo articolo
            } else {
                this._loadArticleData(sObjectId); // Logica per modifica articolo esistente
            }
        },

        // ========================================================================
        // 2. CARICAMENTO DATI
        // ========================================================================
        _createEmptyForm: function () {
            const that = this; // Salva il riferimento al controller per le funzioni interne (callback)
            sap.ui.core.BusyIndicator.show(0); // Mostra l'icona di caricamento e blocca l'interfaccia

            // Interroga il servizio OData per trovare l'ultimo articolo inserito
            this.odataRead("/ZES_articoliSet", {
                "$orderby": "CodArticolo desc", // Ordina per codice in modo decrescente
                "$top": 1                       // Prende solo il primo record (il più alto)
            })
            .then(function (oData) {
                sap.ui.core.BusyIndicator.hide(); // Nasconde l'icona di caricamento
                let iNextCode = 1; // Default se la tabella fosse vuota

                // Se ci sono risultati, calcola il prossimo codice disponibile (+1)
                if (oData.results && oData.results.length > 0) {
                    const iHighestCode = parseInt(oData.results[0].CodArticolo, 10);
                    iNextCode = iHighestCode + 1;
                }

                // Struttura l'oggetto iniziale per il nuovo articolo
                const oEmptyArticle = {
                    CodArticolo: iNextCode,
                    NomeArticolo: "",
                    Importo: 0,
                    QuantitaDisp: 0
                };
                
                // Crea e assegna il modello "formModel" alla View per popolare i campi di input
                that.setModel(new JSONModel(oEmptyArticle), "formModel");
            })
            .catch(function (oError) {
                sap.ui.core.BusyIndicator.hide(); // Nasconde il caricamento in caso di errore
                that.handleBackendError(oError); // Gestisce l'errore tramite funzione centralizzata
                that.onNavBack(); // Riporta l'utente alla pagina precedente
            });
        },

        _loadArticleData: function (sArticleId) {
            const that = this; // Salva il riferimento al controller
            sap.ui.core.BusyIndicator.show(0); // Blocca l'interfaccia
            
            // Costruisce il percorso (path) OData per leggere il singolo record tramite ID
            const sPath = "/ZES_articoliSet(" + sArticleId + ")";

            // Esegue la lettura dei dati dal server SAP
            this.odataRead(sPath)
            .then(function (oData) {
                sap.ui.core.BusyIndicator.hide(); // Sblocca l'interfaccia
                // Carica i dati ricevuti nel modello "formModel" per mostrarli a video
                that.setModel(new JSONModel(oData), "formModel");
            })
            .catch(function (oError) {
                sap.ui.core.BusyIndicator.hide(); // Sblocca l'interfaccia
                that.handleBackendError(oError); // Mostra l'errore del server
                that.onNavBack(); // Torna indietro
            });
        },

        // ========================================================================
        // 3. SALVATAGGIO
        // ========================================================================
        onSave: function () {
            const oFormModel = this.getModel("formModel"); // Recupera i dati inseriti dall'utente
            const oViewModel = this.getModel("viewModel"); // Recupera lo stato della view (new/edit)
            const that = this; // Riferimento al controller

            const oData = oFormModel.getData(); // Estrae l'oggetto dati dal modello
            const bIsNew = oViewModel.getProperty("/isNew"); // Verifica se siamo in creazione

            // --- VALIDAZIONE ---
            // Controlla che il nome dell'articolo non sia vuoto
            if (!oData.NomeArticolo || oData.NomeArticolo.trim() === "") {
                MessageBox.error(this.getText("msgErrorFieldsEmpty"));
                return; // Interrompe l'esecuzione se manca il nome
            }
            // Se è un nuovo articolo, controlla che il codice sia presente
            if (bIsNew && (!oData.CodArticolo || oData.CodArticolo === "")) {
                MessageBox.error(this.getText("msgErrorFieldsEmpty"));
                return;
            }

            // --- PREPARAZIONE DATI (PAYLOAD) ---
            // Converte i valori nei formati corretti per il database SAP (interi e decimali)
            const oPayload = {
                CodArticolo: parseInt(oData.CodArticolo, 10),
                NomeArticolo: oData.NomeArticolo,
                Importo: parseFloat(oData.Importo) || 0,
                QuantitaDisp: parseInt(oData.QuantitaDisp, 10) || 0
            };

            sap.ui.core.BusyIndicator.show(0); // Inizia l'animazione di caricamento

            if (bIsNew) {
                // Esegue una chiamata POST (creazione) al servizio OData
                this.odataCreate("/ZES_articoliSet", oPayload)
                .then(function () {
                    sap.ui.core.BusyIndicator.hide(); // Fine caricamento
                    MessageToast.show(that.getText("msgArticleCreated")); // Messaggio di successo
                    that.getModel().refresh(true); // Forza l'aggiornamento della lista principale
                    that.onNavBack(); // Torna alla lista
                })
                .catch(function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    that.handleBackendError(oError); // Gestione errore SAP
                });
            } else {
                // Esegue una chiamata PUT/MERGE (aggiornamento) al servizio OData
                const sPath = "/ZES_articoliSet(" + oPayload.CodArticolo + ")";
                this.odataUpdate(sPath, oPayload)
                .then(function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageToast.show(that.getText("msgArticleUpdated")); // Conferma modifica
                    that.getModel().refresh(true); // Ricarica i dati
                    that.onNavBack(); // Torna alla lista
                })
                .catch(function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    that.handleBackendError(oError);
                });
            }
        },

        // Gestore per il tasto Annulla
        onCancel: function () {
            this.onNavBack(); // Chiude la pagina senza salvare
        }
    });
});