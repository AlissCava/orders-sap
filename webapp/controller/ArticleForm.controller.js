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
        _createEmptyForm: async function () {
            sap.ui.core.BusyIndicator.show(0); // Mostra l'icona di caricamento e blocca l'interfaccia

            try {
                // Interroga il servizio OData asincrono per trovare l'ultimo articolo inserito
                const oData = await this.odataRead("/ZES_articoliSet", {
                    "$orderby": "CodArticolo desc", // Ordina per codice in modo decrescente
                    "$top": 1                       // Prende solo il primo record (il più alto)
                });

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
                this.setModel(new JSONModel(oEmptyArticle), "formModel");

            } catch (oError) {
                sap.ui.core.BusyIndicator.hide(); // Nasconde il caricamento in caso di errore
                this.handleBackendError(oError); // Gestisce l'errore tramite funzione centralizzata
                this.onNavBack(); // Riporta l'utente alla pagina precedente
            }
        },

        _loadArticleData: async function (sArticleId) {
            sap.ui.core.BusyIndicator.show(0); // Blocca l'interfaccia
            
            // Costruisce il percorso (path) OData per leggere il singolo record tramite ID
            const sPath = "/ZES_articoliSet(" + sArticleId + ")";

            try {
                // Esegue la lettura asincrona dei dati dal server SAP
                const oData = await this.odataRead(sPath);
                sap.ui.core.BusyIndicator.hide(); // Sblocca l'interfaccia
                
                // Carica i dati ricevuti nel modello "formModel" per mostrarli a video
                this.setModel(new JSONModel(oData), "formModel");

            } catch (oError) {
                sap.ui.core.BusyIndicator.hide(); // Sblocca l'interfaccia
                this.handleBackendError(oError); // Mostra l'errore del server
                this.onNavBack(); // Torna indietro
            }
        },

        // ========================================================================
        // 3. SALVATAGGIO
        // ========================================================================
        onSave: async function () {
            const oFormModel = this.getModel("formModel"); // Recupera i dati inseriti dall'utente
            const oViewModel = this.getModel("viewModel"); // Recupera lo stato della view (new/edit)

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

            try {
                if (bIsNew) {
                    // Esegue una chiamata POST asincrona (creazione) al servizio OData
                    await this.odataCreate("/ZES_articoliSet", oPayload);
                    sap.ui.core.BusyIndicator.hide(); // Fine caricamento
                    MessageToast.show(this.getText("msgArticleCreated")); // Messaggio di successo
                } else {
                    // Esegue una chiamata PUT/MERGE asincrona (aggiornamento) al servizio OData
                    const sPath = "/ZES_articoliSet(" + oPayload.CodArticolo + ")";
                    await this.odataUpdate(sPath, oPayload);
                    sap.ui.core.BusyIndicator.hide();
                    MessageToast.show(this.getText("msgArticleUpdated")); // Conferma modifica
                }

                this.getModel().refresh(true); // Forza l'aggiornamento della lista principale
                this.onNavBack(); // Torna alla lista

            } catch (oError) {
                sap.ui.core.BusyIndicator.hide();
                this.handleBackendError(oError); // Gestione errore SAP
            }
        },

        // Gestore per il tasto Annulla
        onCancel: function () {
            this.onNavBack(); // Chiude la pagina senza salvare
        }
    });
});