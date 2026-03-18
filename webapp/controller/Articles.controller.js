sap.ui.define([
    "orders/controller/BaseController", // Il nostro controller "padre"
    "sap/ui/model/json/JSONModel",      // Per il modello locale del popup
    "sap/m/MessageToast",               // Per i messaggi a comparsa rapida (es. "Salvato!")
    "sap/m/MessageBox"                  // Per i messaggi di errore bloccanti del backend
], function (BaseController, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return BaseController.extend("orders.controller.Articles", {

        // ------------------------------------------------------------------------
        // 1. INIZIALIZZAZIONE
        // ------------------------------------------------------------------------
        onInit: function () {
            // Creiamo un modello locale ('articleModel') dedicato solo a questa pagina.
            // Ci serve per due motivi:
            // 1. Legare gli input del form senza usare i this.byId().getValue()
            // 2. Tenere traccia se stiamo creando un NUOVO articolo o MODIFICANDO uno esistente (isEditMode)
            const oLocalModel = new JSONModel({
                newArticle: {
                    CodArticolo: "",
                    NomeArticolo: "",
                    QuantitaDisp: "0",
                    Importo: "0.00"
                },
                isEditMode: false // Flag: Falso = Creazione, Vero = Modifica
            });
            
            // Assegniamo il modello dandogli un nome, così non si confonde con il modello OData globale
            this.setModel(oLocalModel, "articleModel");
        },

        // ------------------------------------------------------------------------
        // 2. GESTIONE DEL DIALOG (POPUP)
        // ------------------------------------------------------------------------

        // Quando clicchi su "Nuovo Articolo"
        onOpenAddArticleDialog: function () {
            const oLocalModel = this.getModel("articleModel");
            
            // Resettiamo i campi per assicurarci che il popup sia vuoto
            oLocalModel.setProperty("/newArticle", {
                CodArticolo: "",
                NomeArticolo: "",
                QuantitaDisp: "0",
                Importo: "0.00"
            });
            // Diciamo all'app che siamo in modalità "Creazione"
            oLocalModel.setProperty("/isEditMode", false);

            this.byId("addArticleDialog").open();
        },

        // Quando clicchi su una riga esistente per modificarla
        onEditArticle: function (oEvent) {
            // 1. Scopriamo quale riga è stata cliccata tramite il "Binding Context"
            const oContext = oEvent.getSource().getBindingContext(); // Non specifichiamo il nome perché OData è il modello di default
            const oSelectedArticle = oContext.getObject(); // Estrae l'oggetto riga (CodArticolo, NomeArticolo, ecc.)

            const oLocalModel = this.getModel("articleModel");

            // 2. Copiamo i dati della riga dentro il nostro modello del popup.
            // Usiamo Object.assign({}, ...) per fare una copia e non modificare accidentalmente la tabella 
            // prima che l'utente prema "Salva".
            oLocalModel.setProperty("/newArticle", Object.assign({}, oSelectedArticle));
            
            // 3. Diciamo all'app che siamo in modalità "Modifica"
            oLocalModel.setProperty("/isEditMode", true);

            this.byId("addArticleDialog").open();
        },

        // Quando clicchi "Annulla" nel popup
        onCloseArticleDialog: function () {
            this.byId("addArticleDialog").close();
        },

        // ------------------------------------------------------------------------
        // 3. COMUNICAZIONE CON IL BACKEND ODATA (CREATE & UPDATE)
        // ------------------------------------------------------------------------
        
        onSaveArticle: function () {
            const oBundle = this.getResourceBundle();
            const oLocalModel = this.getModel("articleModel");
            
            // Leggiamo i dati dal modello locale (niente byId!)
            const oArticleData = oLocalModel.getProperty("/newArticle");
            const bIsEditMode = oLocalModel.getProperty("/isEditMode");

            // Validazione base: controlliamo se i campi chiave sono vuoti
            if (!oArticleData.CodArticolo || !oArticleData.NomeArticolo) {
                MessageBox.error(oBundle.getText("msgErrorFieldsEmpty"));
                return; // Blocca l'esecuzione
            }

            // Preparazione dei dati: formattiamo i numeri in stringhe, 
            // dato che nel backend ABAP i campi NUMC (es. numc3, numc4) viaggiano solitamente come stringhe.
            const oPayload = {
                CodArticolo: oArticleData.CodArticolo.toString(),
                NomeArticolo: oArticleData.NomeArticolo,
                QuantitaDisp: oArticleData.QuantitaDisp.toString(),
                Importo: oArticleData.Importo.toString()
            };

            // Prendiamo il modello OData ufficiale (quello globale, senza nome)
            const oODataModel = this.getModel();

            // Mostriamo una rotellina di caricamento durante la chiamata al server
            sap.ui.core.BusyIndicator.show(0);

            const that = this; // Salviamo il "this" per usarlo dentro le funzioni di successo/errore

            if (bIsEditMode) {
                // --- UPDATE: MODIFICA ARTICOLO ---
                // Il percorso OData per modificare deve includere la chiave (es. "/ZES_articoliSet('101')")
                const sPath = "/ZES_articoliSet('" + oPayload.CodArticolo + "')";

                oODataModel.update(sPath, oPayload, {
                    success: function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show(oBundle.getText("msgArticleUpdated"));
                        that.onCloseArticleDialog();
                    },
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        that._handleBackendError(oError);
                    }
                });

            } else {
                // --- CREATE: NUOVO ARTICOLO ---
                // Il percorso OData per creare punta alla "cartella" generale (EntitySet)
                oODataModel.create("/ZES_articoliSet", oPayload, {
                    success: function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show(oBundle.getText("msgArticleCreated"));
                        that.onCloseArticleDialog();
                    },
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        // Chiamiamo una funzione dedicata per estrarre l'errore dal BE
                        that._handleBackendError(oError); 
                    }
                });
            }
        },

        // ------------------------------------------------------------------------
        // 5. ELIMINAZIONE ARTICOLO (DELETE ODATA)
        // ------------------------------------------------------------------------

        // Questa funzione scatta quando l'utente preme il tasto "Elimina" su una riga
        onDeleteArticle: function (oEvent) {
            // 1. Identifichiamo l'articolo cliccato
            const oContext = oEvent.getParameter("listItem").getBindingContext();
            const sPath = oContext.getPath(); // Es: "/ZES_articoliSet('101')"

            const oBundle = this.getResourceBundle();
            const that = this; // Salviamo il riferimento al controller

            // 2. Chiediamo conferma all'utente prima di cancellare definitivamente
            sap.m.MessageBox.confirm(oBundle.getText("msgDeleteConfirm"), {
                title: "Conferma Eliminazione",
                actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                onClose: function (sAction) {
                    if (sAction === sap.m.MessageBox.Action.YES) {
                        // Se l'utente dice SI, avviamo la cancellazione sul backend
                        that._deleteArticleFromBackend(sPath);
                    }
                }
            });
        },

        // Funzione interna che fa la vera chiamata OData al server SAP
        _deleteArticleFromBackend: function (sPath) {
            const oODataModel = this.getModel(); // Prendiamo il modello OData principale
            const oBundle = this.getResourceBundle();
            const that = this;

            sap.ui.core.BusyIndicator.show(0); // Mostriamo il caricamento

            // Metodo OData 'remove' per eliminare l'entità
            oODataModel.remove(sPath, {
                success: function () {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageToast.show(oBundle.getText("msgArticleDeleted"));
                },
                error: function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    that._handleBackendError(oError); // Ricicliamo la nostra funzione per gli errori
                }
            });
        },

        // ------------------------------------------------------------------------
        // 4. GESTIONE ERRORI DAL BACKEND ODATA (PUNTO 5 DELLA TO-DO)
        // ------------------------------------------------------------------------
        
        // Questa funzione "smonta" il pacchetto di errore che SAP ci invia indietro
        // per estrarre il testo del messaggio (es. "Inserimento non andato a buon fine")
        _handleBackendError: function (oError) {
            const oBundle = this.getResourceBundle();
            let sMsg = oBundle.getText("msgErrorBackend"); // Messaggio generico di default (USIAMO LET PERCHE' VERRA' SOVRASCRITTO)

            try {
                // Il server OData restituisce gli errori in formato testo/JSON dentro oError.responseText
                const oErrorObj = JSON.parse(oError.responseText);
                if (oErrorObj.error && oErrorObj.error.message && oErrorObj.error.message.value) {
                    sMsg = oErrorObj.error.message.value; // Estrae il messaggio reale da SAP
                }
            } catch (e) {
                // Se la risposta non è un JSON valido, teniamo il messaggio di default
            }

            // Mostra un popup bloccante con l'errore
            MessageBox.error(sMsg);
        }
    });
});