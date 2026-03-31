sap.ui.define([
    "orders/controller/BaseController", // Il nostro controller "padre" con le funzioni base
    "sap/m/MessageToast",               // Per i messaggi verdi a comparsa rapida (es. "Eliminato!")
    "sap/m/MessageBox",                 // Per i messaggi di errore bloccanti
    "sap/ui/export/Spreadsheet"         // per esportazione exel
], function (BaseController, MessageToast, MessageBox) {
    "use strict";

    return BaseController.extend("orders.controller.Articles", {

        // ========================================================================
        // 1. INIZIALIZZAZIONE
        // ========================================================================
        onInit: function () {
            // In questa nuova architettura a pagina intera, la lista degli articoli
            // non ha più bisogno di un modello locale per i popup.
            // Si occupa solo di leggere i dati dal server (lo fa già l'XML da solo)
            // e di smistare il traffico verso il nuovo Form.
        },

        // ========================================================================
        // 2. NAVIGAZIONE (IL "VIGILE URBANO")
        // ========================================================================

        // Questa funzione scatta quando premi il bottone "Nuovo Articolo" in alto
        onCreateArticle: function () {
            // Usiamo il Router di SAPUI5 per cambiare pagina.
            // Diciamo: "Portami alla pagina RouteArticleForm e passagli il parametro 'new'".
            // Il controller di destinazione leggerà 'new' e capirà che deve creare un form vuoto.
            this.getRouter().navTo("RouteArticleForm", {
                objectId: "new"
            });
        },

        // Questa funzione scatta quando CLICCHI SU UNA RIGA della tabella
        onArticlePress: function (oEvent) {
            // 1. Capiamo esattamente quale riga della tabella hai cliccato
            const oItem = oEvent.getSource();
            
            // 2. Estraiamo il "Codice Articolo" specifico di quella riga (es. "10")
            const sArticleCode = oItem.getBindingContext().getProperty("CodArticolo");
            
            // 3. Diciamo al Router: "Portami alla pagina RouteArticleForm, 
            // ma passagli il codice articolo invece di 'new'".
            // Il controller di destinazione leggerà il numero e scaricherà i dati da SAP.
            this.getRouter().navTo("RouteArticleForm", {
                objectId: sArticleCode
            });
        },

        // ========================================================================
        // 3. ELIMINAZIONE ARTICOLO (DELETE ODATA)
        // ========================================================================

        // Questa funzione scatta quando l'utente preme il cestino rosso o il tasto "Elimina"
        onDeleteArticle: function (oEvent) {
            // 1. Identifichiamo il percorso esatto dell'articolo sul server
            // oContext.getPath() ci darà una stringa tipo: "/ZES_articoliSet(10)"
            // Usa "getParameter('listItem')" se il tasto elimina è gestito dalla lista,
            // oppure "getSource()" se il tasto è dentro la riga stessa.
            let oContext;
            if (oEvent.getParameter("listItem")) {
                oContext = oEvent.getParameter("listItem").getBindingContext();
            } else {
                oContext = oEvent.getSource().getBindingContext();
            }
            
            const sPath = oContext.getPath(); 
            const that = this; // Salviamo il controller in memoria

            // 2. Chiediamo conferma all'utente (non si sa mai, magari ha cliccato per sbaglio!)
            MessageBox.confirm("Sei sicura di voler eliminare questo articolo?", {
                title: "Conferma Eliminazione",
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.YES) {
                        // Se l'utente dice SI, procediamo con l'esecuzione!
                        that._deleteArticleFromBackend(sPath);
                    }
                }
            });
        },

        // ========================================================================
        // 4. CHIAMATA AL SERVER (IL LAVORO SPORCO)
        // ========================================================================

        // Funzione interna che bussa al server SAP e chiede la cancellazione
        _deleteArticleFromBackend: function (sPath) {
            // Prendiamo il modello OData globale (quello che parla col backend)
            const oODataModel = this.getOwnerComponent().getModel(); 
            const that = this;

            // Mostriamo la rotellina di caricamento
            sap.ui.core.BusyIndicator.show(0); 

            // Chiamata HTTP DELETE verso SAP
            oODataModel.remove(sPath, {
                success: function () {
                    MessageToast.show("Articolo eliminato con successo!");
                    // Non serve ricaricare la pagina, la riga sparirà da sola dalla tabella!
                },
                error: function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    that._handleBackendError(oError); // Deleghiamo la gestione dell'errore
                }
            });
        },

        // ========================================================================
        // EXPORT EXCEL (PUNTO 10)
        // ========================================================================
        onExportExcel: function () {
            // 1. Diciamo al programma quale tabella vogliamo esportare (tramite il suo ID)
            const oTable = this.byId("articlesTable"); 
            const oRowBinding = oTable.getBinding("items"); // Prendiamo i dati agganciati alla tabella
            const oBundle = this.getResourceBundle();

            // 2. Definiamo come dovranno chiamarsi le colonne nel file Excel
            // e a quali campi del database SAP corrispondono.
            const aCols = [
                { 
                    label: oBundle.getText("colArticleCode"), 
                    property: "CodArticolo", 
                    type: "string" 
                },
                { 
                    label: oBundle.getText("colArticleName"), 
                    property: "NomeArticolo", 
                    type: "string" 
                },
                { 
                    label: oBundle.getText("colPrice"), 
                    property: "Importo", 
                    type: "number",
                    scale: 2 // Mostra 2 decimali per i soldi
                },
                { 
                    label: oBundle.getText("colAvailableQty"), 
                    property: "QuantitaDisp", 
                    type: "number" 
                }
            ];

            // 3. Prepariamo le impostazioni del file
            const oSettings = {
                workbook: { columns: aCols },
                dataSource: oRowBinding, // I dati da scrivere
                fileName: "Export_Articoli.xlsx", // Il nome del file scaricato
                worker: false
            };

            // 4. Avviamo la generazione del file e puliamo la memoria alla fine
            const oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function() {
                oSheet.destroy();
            });
        },
    });
});