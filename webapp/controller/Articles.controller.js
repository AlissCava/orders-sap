sap.ui.define([
    "orders/controller/BaseController", 
    "sap/m/MessageToast",               
    "sap/m/MessageBox",                 
    "sap/ui/export/Spreadsheet"         // Importa la libreria SAP standard per generare file Excel
], function (BaseController, MessageToast, MessageBox, Spreadsheet) { 
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
                onClose: function (sAction) {
                    // Se l'utente conferma cliccando su "YES"
                    if (sAction === MessageBox.Action.YES) {
                        sap.ui.core.BusyIndicator.show(0); // Blocca l'interfaccia

                        // Chiama il metodo DELETE definito nel BaseController
                        that.odataDelete(sPath)
                        .then(function () {
                            sap.ui.core.BusyIndicator.hide(); // Sblocca l'interfaccia
                            // Mostra un messaggio di avvenuta eliminazione
                            MessageToast.show(that.getText("msgArticleDeleted"));
                        })
                        .catch(function (oError) {
                            sap.ui.core.BusyIndicator.hide();
                            // In caso di errore (es: vincoli a DB), lo gestisce in modo centralizzato
                            that.handleBackendError(oError); 
                        });
                    }
                }
            });
        },

        // ========================================================================
        // EXPORT EXCEL
        // ========================================================================
        
        // Genera un file Excel basato sui dati attualmente visibili in tabella
        onExportExcel: function () {
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
            // Avvia la generazione del file e assicura la pulizia della memoria alla fine
            oSheet.build().finally(function() {
                oSheet.destroy(); // Distrugge l'oggetto per liberare risorse RAM
            });
        }
    });
});