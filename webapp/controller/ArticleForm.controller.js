sap.ui.define([
    "orders/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (BaseController, JSONModel, MessageBox, MessageToast) {
    "use strict";

    return BaseController.extend("orders.controller.ArticleForm", {

        // ========================================================================
        // 1. INIZIALIZZAZIONE E GESTIONE DELLA ROTTA (URL)
        // ========================================================================
        onInit: function () {
            // Colleghiamo la funzione _onRouteMatched all'evento di navigazione.
            // Ogni volta che l'URL cambia e corrisponde a "RouteArticleForm" (es. /article/new o /article/10),
            // SAPUI5 eseguirà automaticamente la funzione _onRouteMatched.
            this.getRouter().getRoute("RouteArticleForm").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            // Estraiamo il parametro "objectId" dall'URL. 
            // Se abbiamo cliccato "Crea Nuovo", objectId sarà "new".
            // Se abbiamo cliccato su un articolo esistente, objectId sarà il suo numero (es. "10").
            const sObjectId = oEvent.getParameter("arguments").objectId;
            
            // Controlliamo se siamo in modalità "Creazione" o "Modifica"
            const bIsNew = (sObjectId === "new");
            
            // Creiamo il "viewModel". Questo modello serve SOLO per controllare l'interfaccia grafica.
            // Ci permette di cambiare il titolo della pagina e di bloccare/sbloccare i campi (es. il Codice Articolo)
            const oViewModel = new JSONModel({
                isNew: bIsNew,
                viewTitle: bIsNew ? "New Article" : "Edit Article " + sObjectId
            });
            this.setModel(oViewModel, "viewModel");

            // In base alla modalità, decidiamo quale funzione chiamare per preparare i dati
            if (bIsNew) {
                this._createEmptyForm(); // Prepara un form vuoto
            } else {
                this._loadArticleData(sObjectId); // Scarica i dati dal server SAP
            }
        },

        // ========================================================================
        // 2. PREPARAZIONE E CARICAMENTO DEI DATI (IL "formModel")
        // ========================================================================
        _createEmptyForm: function () {
            // Prepariamo un oggetto Javascript vuoto con la stessa struttura che si aspetta SAP.
            // Questo è fondamentale per far funzionare il "Two-Way Binding" (collegamento bidirezionale) con l'XML.
            const oEmptyArticle = {
                CodArticolo: "",
                NomeArticolo: "",
                Importo: 0,
                QuantitaDisp: 0
            };
            
            // Inseriamo questo oggetto in un JSONModel chiamato "formModel"
            const oFormModel = new JSONModel(oEmptyArticle);
            this.setModel(oFormModel, "formModel");
        },

        _loadArticleData: function (sArticleId) {
            // Recuperiamo il modello OData principale (quello che parla con il server SAP)
            const oODataModel = this.getOwnerComponent().getModel();
            const that = this; // Salviamo il riferimento al controller per usarlo dentro le funzioni success/error

            // Mostriamo la rotellina di caricamento per avvisare l'utente che stiamo contattando il server
            sap.ui.core.BusyIndicator.show(0);

            // Costruiamo il percorso esatto per leggere un singolo articolo. Esempio: /ZES_articoliSet(10)
            const sPath = "/ZES_articoliSet(" + sArticleId + ")";

            // Effettuiamo la chiamata di LETTURA (GET) al server SAP
            oODataModel.read(sPath, {
                success: function (oData) {
                    sap.ui.core.BusyIndicator.hide(); // Nascondiamo la rotellina
                    
                    // Prendiamo i dati che SAP ci ha restituito e li mettiamo nel nostro "formModel".
                    // Così facendo, i campi dell'interfaccia XML si popoleranno magicamente da soli.
                    const oFormModel = new JSONModel(oData);
                    that.setModel(oFormModel, "formModel");
                },
                error: function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error("Article not found or server rejected the request.");
                    that.onNavBack(); // Se c'è un errore (es. articolo inesistente), torniamo indietro
                }
            });
        },

        // ========================================================================
        // 3. SALVATAGGIO DEI DATI (CREAZIONE O MODIFICA)
        // ========================================================================
        onSave: function () {
            // Recuperiamo i modelli che ci servono
            const oFormModel = this.getModel("formModel");
            const oViewModel = this.getModel("viewModel");
            const oODataModel = this.getOwnerComponent().getModel();
            const that = this;

            // Estraiamo i dati correnti digitati dall'utente e lo stato (Nuovo o Modifica)
            const oData = oFormModel.getData();
            const bIsNew = oViewModel.getProperty("/isNew");

            // --- FASE 1: VALIDAZIONE ---
            // Controlliamo che l'utente non abbia lasciato vuoti i campi obbligatori
            if (!oData.NomeArticolo || oData.NomeArticolo.trim() === "") {
                MessageBox.error("Article name is mandatory.");
                return; // Blocchiamo l'esecuzione, non inviamo nulla a SAP
            }
            if (bIsNew && (!oData.CodArticolo || oData.CodArticolo === "")) {
                MessageBox.error("Article code is mandatory for new articles.");
                return;
            }

            // --- FASE 2: PREPARAZIONE DEL PAYLOAD ---
            // Il "Payload" è il pacchetto di dati che spediamo a SAP.
            // SAP è molto rigido sui tipi di dato (es. vuole un numero per il prezzo, non una stringa di testo).
            // Quindi convertiamo esplicitamente i valori (es. parseInt per gli interi, parseFloat per i decimali).
            const oPayload = {
                CodArticolo: parseInt(oData.CodArticolo, 10),
                NomeArticolo: oData.NomeArticolo,
                Importo: parseFloat(oData.Importo) || 0,
                QuantitaDisp: parseInt(oData.QuantitaDisp, 10) || 0
            };

            sap.ui.core.BusyIndicator.show(0);

            // --- FASE 3: INVIO A SAP ---
            if (bIsNew) {
                // SE È NUOVO: Usiamo oODataModel.create (che corrisponde a una richiesta HTTP POST)
                oODataModel.create("/ZES_articoliSet", oPayload, {
                    success: function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show("Article successfully created!");
                        
                        // Diciamo al modello globale di ricaricarsi. Così quando torniamo alla lista,
                        // vedremo apparire immediatamente il nostro nuovo articolo.
                        oODataModel.refresh(true); 
                        
                        that.onNavBack(); // Torniamo alla pagina precedente
                    },
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        that._showError(oError); // Usiamo la nostra funzione helper per leggere l'errore
                    }
                });
            } else {
                // SE È UNA MODIFICA: Usiamo oODataModel.update (che corrisponde a una richiesta HTTP PUT)
                // Dobbiamo dire a SAP esattamente QUALE articolo stiamo modificando indicando l'ID nel percorso
                const sPath = "/ZES_articoliSet(" + oPayload.CodArticolo + ")";
                
                oODataModel.update(sPath, oPayload, {
                    success: function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show("Article successfully updated!");
                        oODataModel.refresh(true); 
                        that.onNavBack();
                    },
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        that._showError(oError);
                    }
                });
            }
        },

        // ========================================================================
        // 4. FUNZIONI DI SUPPORTO E NAVIGAZIONE
        // ========================================================================
        
        // Questa funzione serve a "scavare" dentro la risposta di errore di SAP.
        // Spesso gli errori di SAP sono oggetti JSON complessi, noi vogliamo estrarre solo
        // la frase di testo leggibile (es. "Quantità non valida") per mostrarla all'utente.
        _showError: function(oError) {
            let sMsg = "Error during save.";
            try {
                const oErrorObj = JSON.parse(oError.responseText);
                if (oErrorObj.error && oErrorObj.error.message) {
                    sMsg = oErrorObj.error.message.value;
                }
            } catch (e) {
                // Se non riusciamo a leggere il JSON, teniamo il messaggio generico
            }
            MessageBox.error(sMsg);
        },

        onCancel: function () {
            // Se l'utente clicca Annulla, torniamo semplicemente indietro senza salvare nulla
            this.onNavBack();
        }
    });
});     