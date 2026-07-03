sap.ui.define([
    "orders/controller/BaseController", 
    "sap/m/MessageToast",              
    "sap/m/MessageBox",                 
    "sap/ui/export/Spreadsheet",
    "sap/ui/model/Filter",              // FIX: Iniettato filtro mancante
    "sap/ui/model/FilterOperator",      // FIX: Iniettato operatore mancante
    "sap/ui/core/InvisibleMessage", 
    "sap/ui/core/library",

], function (BaseController, MessageToast, MessageBox, Spreadsheet, Filter, FilterOperator) { 
    "use strict";

    return BaseController.extend("orders.controller.Articles", {

        onInit: function () {
            // In questo caso l'onInit è vuoto perché il caricamento dati è gestito dal binding nell'XML
        },

        // ========================================================================
        // NAVIGAZIONE
        // ========================================================================
        
        // Funzione chiamata al clic sul tasto "Aggiungi" o "Crea"
        onCreateArticle: function () {
            // Naviga alla rotta del form passando "new" come ID per indicare un nuovo inserimento
            this.getRouter().navTo("RouteArticleForm", {
                objectId: "new"
            });
        },

        // Funzione chiamata quando l'utente clicca su una riga della tabella
        onArticlePress: function (oEvent) {
            // Ottiene l'oggetto (la riga) che ha scatenato l'evento
            const oItem = oEvent.getSource();
            // Recupera dal contesto del binding il valore della proprietà "CodArticolo"
            const sArticleCode = oItem.getBindingContext().getProperty("CodArticolo");
            // Naviga al form passando il codice dell'articolo selezionato per la modifica
            this.getRouter().navTo("RouteArticleForm", {
                objectId: sArticleCode
            });
        },

       // ========================================================================
    // ELIMINAZIONE
    // ========================================================================

    // Gestisce l'eliminazione di un articolo
    onDeleteArticle: function (oEvent) {
        let oContext;
        
        // Verifica la provenienza dell'evento (pressione riga o pulsante specifico)
        if (oEvent.getParameter("listItem")) {
            // Se l'evento è "delete" della lista, prende l'item dai parametri
            oContext = oEvent.getParameter("listItem").getBindingContext();
        } else {
            // Altrimenti prende il contesto direttamente dal pulsante cliccato
            oContext = oEvent.getSource().getBindingContext();
        }
        
        // Ottiene il path OData relativo all'articolo (es: /ZES_articoliSet(10))
        const sPath = oContext.getPath(); 
        const that = this; // Riferimento al controller per le callback

        // Mostra un popup di conferma prima di procedere
        MessageBox.confirm(this.getText("msgDeleteConfirm"), {
            title: this.getText("appTitle"),
            actions: [MessageBox.Action.YES, MessageBox.Action.NO], // Pulsanti Sì/No
            
            // Rendiamo la funzione di callback asincrona per poter usare await
            onClose: async function (sAction) {
                if (sAction === MessageBox.Action.YES) {
                    sap.ui.core.BusyIndicator.show(0); // Blocca l'interfaccia

                    try {
                        // Chiama il metodo DELETE in modo asincrono
                        await that.odataDelete(sPath);
                        
                        sap.ui.core.BusyIndicator.hide(); // Sblocca l'interfaccia
                        
                        // --- INIZIO MAGIA A11Y ---
                        // Recuperiamo il testo tradotto una sola volta
                        const sMessage = that.getText("msgArticleDeleted");
                        
                        // Messaggio visivo per i vedenti
                        MessageToast.show(sMessage);
                        
                        // Annuncio vocale per lo screen reader in modalità Assertive
                        var oInvisibleMessage = sap.ui.core.InvisibleMessage.getInstance();
                        oInvisibleMessage.announce(sMessage, sap.ui.core.InvisibleMessageMode.Assertive);
                        // --- FINE MAGIA A11Y ---
                        
                    } catch (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        // In caso di errore lo gestisce in modo centralizzato
                        that.handleBackendError(oError); 
                    }
                }
            }
        });
        },
        // ========================================================================
        // EXPORT EXCEL
        // ========================================================================
        
        // Genera un file Excel basato sui dati attualmente visibili in tabella
        onExportExcel: async function () {
            // Recupera l'istanza della tabella tramite il suo ID
            const oTable = this.byId("articlesTable"); 
            // Ottiene il binding degli elementi (i dati caricati dal server)
            const oRowBinding = oTable.getBinding("items"); 
            const oBundle = this.getResourceBundle(); // Carica le traduzioni

            // Definisce la struttura delle colonne del file Excel
            const aCols = [
                { label: oBundle.getText("colArticleCode"), property: "CodArticolo", type: "string" },
                { label: oBundle.getText("colArticleName"), property: "NomeArticolo", type: "string" },
                { label: oBundle.getText("colPrice"), property: "Importo", type: "number", scale: 2 },
                { label: oBundle.getText("colAvailableQty"), property: "QuantitaDisp", type: "number" }
            ];

            // Configurazione del worker e dei parametri di esportazione
            const oSettings = {
                workbook: { columns: aCols }, // Assegna le colonne definite sopra
                dataSource: oRowBinding,      // Fonte dei dati: il binding della tabella
                fileName: "Export_Articoli.xlsx", // Nome del file in uscita
                worker: false                 // Disabilita i web worker (più semplice per il debug)
            };

            // Crea un nuovo oggetto Spreadsheet con le impostazioni definite
            const oSheet = new Spreadsheet(oSettings);
            
            try {
                // Avvia la generazione del file in modo asincrono
                await oSheet.build();
            } finally {
                // Assicura la pulizia della memoria in ogni caso (sia successo che errore)
                oSheet.destroy(); 
            }
        },
        
        // ========================================================================
        // RICERCA FILTRATA ARTICOLI (PER NOME)
        // ========================================================================
        onSearchArticle: function (oEvent) {
            // Prepariamo l'array dei filtri vuoto
            const aFilters = [];
            
            // Leggiamo la parola che l'utente sta digitando
            const sQuery = oEvent.getSource().getValue();

            // Se c'è del testo, creiamo il filtro
            if (sQuery && sQuery.length > 0) {
                // "NomeArticolo" è il campo esatto che hai nel database per questa View
                // Contains cerca la parola ovunque all'interno del nome
                const oFilter = new Filter("NomeArticolo", FilterOperator.Contains, sQuery);
                aFilters.push(oFilter);
            }

            // Recuperiamo la tabella dal suo ID ("articlesTable") e applichiamo il filtro
            const oTable = this.byId("articlesTable");
            const oBinding = oTable.getBinding("items");
            oBinding.filter(aFilters);
        },

        // ========================================================================
        // CONTEGGIO DINAMICO RECORD TITOLO
        // ========================================================================
        onTableUpdateFinished: function (oEvent) {
            // Recupera il totale dei record restituiti dal backend OData per questa tabella
            const iTotalItems = oEvent.getParameter("total");
            
            // Ottiene il riferimento al controllo del titolo nella toolbar
            const oTitle = this.byId("articlesTableTitle");
            
            if (oTitle) {
                const oBundle = this.getResourceBundle();
                // Recupera il testo base tradotto (es. "Gestione Articoli" o "Articoli")
                const sBaseTitle = oBundle ? oBundle.getText("articlesPageTitle") : "Articoli";
                
                // Aggiorna il titolo aggiungendo il contatore dinamico
                oTitle.setText(sBaseTitle + " (" + iTotalItems + ")");
            }
        }
    });
});