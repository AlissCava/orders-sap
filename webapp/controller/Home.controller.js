sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/export/Spreadsheet", // Libreria ufficiale SAP per creare file Excel
    "sap/ui/model/Filter",       // Strumento per creare le regole di ricerca (es. "contiene la parola X")
    "sap/ui/model/FilterOperator"// Operatori matematici/logici per i filtri (es. "Uguale a", "Maggiore di", "Contiene")
], function (Controller, Spreadsheet, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("orders.controller.Home", {

        // ------------------------------------------------------------------------
        // INIZIALIZZAZIONE
        // ------------------------------------------------------------------------
        onInit: function () {
            // Questa funzione parte una volta sola all'avvio della pagina.
            // Attualmente è vuota perché i dati vengono caricati in automatico dal manifest.json
        },


        // ------------------------------------------------------------------------
        // IL RAGIONIERE: CALCOLO DEI TOTALI A FONDO PAGINA
        // ------------------------------------------------------------------------

        // 1. L'innesco: Questa funzione scatta automaticamente ogni volta che la tabella ha finito di 
        // aggiornarsi (es. caricamento iniziale, dopo una ricerca, o dopo aver cambiato pagina).
        onTableUpdateFinished: function () {
            // Chiama la funzione interna che fa i veri calcoli matematici
            this._calculateTotal();
        },

        // 2. Il motore di calcolo: fa i conti fisicamente
        _calculateTotal: function () {

            // Andiamo a prendere il database completo in memoria
            var oModel = this.getView().getModel("ordersModel");
            var aOrders = oModel.getProperty("/Orders");

            // Prepariamo i nostri "pallottolieri" partendo da zero
            var iOrdiniValidi = 0; // Conta solo gli ordini reali (esclude i cancellati)
            var iPezzi = 0;        // Conta la quantità totale fisica di articoli venduti
            var fValore = 0;       // Conta il fatturato totale in Euro (usiamo 'f' per Float, numero con virgola)

            // Sistema di sicurezza: facciamo i conti solo se il database esiste davvero
            if (aOrders) {

                // Ciclo (loop): passiamo in rassegna ogni singolo ordine dall'inizio alla fine
                for (var i = 0; i < aOrders.length; i++) {

                    // IL FILTRO LOGICO: Vogliamo contare solo gli ordini validi.
                    // Se lo stato dell'ordine corrente è DIVERSO DA (!==) "Cancellato", allora facciamo i conti.
                    if (aOrders[i].Status !== "Cancellato") {

                        // 1. Aggiunge 1 al contatore degli ordini validi
                        iOrdiniValidi++;

                        // 2. Somma la quantità di questo ordine al totale dei pezzi
                        iPezzi += aOrders[i].Quantity;

                        // 3. Calcola il costo di questa riga (Prezzo * Quantità) e lo somma al fatturato
                        fValore += (aOrders[i].UnitPrice * aOrders[i].Quantity);
                    }
                }
            }

            // Andiamo a "pescare" i tre testi (Text/ObjectNumber) dalla nostra View usando i loro ID
            var oTxtOrdini = this.byId("txtTotaleOrdini");
            var oTxtPezzi = this.byId("txtPezziVenduti");
            var oNumValore = this.byId("numValoreTotale");

            // Inseriamo i risultati calcolati dentro l'interfaccia visiva per mostrarli all'utente
            if (oTxtOrdini) {
                oTxtOrdini.setText(iOrdiniValidi);
            }
            if (oTxtPezzi) {
                oTxtPezzi.setText(iPezzi);
            }
            if (oNumValore) {
                // toFixed(2) formatta il numero forzando sempre due cifre decimali (es. 150 diventa 150.00)
                oNumValore.setNumber(fValore.toFixed(2));
            }
        },


        // ------------------------------------------------------------------------
        // ESPORTAZIONE EXCEL
        // ------------------------------------------------------------------------
        onExport: function () {

            // 1. Creiamo la "mappa" per l'Excel: definiamo quali colonne vogliamo
            // "label" è l'intestazione della colonna su Excel, "property" è il nome del campo nel nostro JSON
            var aCols = [
                { label: "ID Ordine", property: "OrderID" },
                { label: "Cliente", property: "CustomerName" },
                { label: "Prodotto", property: "Product" },
                { label: "Quantità", property: "Quantity" },
                { label: "Prezzo Unitario (€)", property: "UnitPrice" },
                { label: "Stato", property: "Status" },
                { label: "Data Ordine", property: "OrderDate" } // Anche se non la mostriamo, la esportiamo!
            ];

            // 2. Recuperiamo l'intera lista degli ordini dalla memoria
            var oModel = this.getView().getModel("ordersModel");
            var aOrders = oModel.getProperty("/Orders");

            // 3. Assembliamo le istruzioni per il motore di esportazione
            var oSettings = {
                workbook: { columns: aCols },    // La struttura delle colonne
                dataSource: aOrders,             // I dati crudi da infilarci dentro
                fileName: "Elenco_Ordini_SAP.xlsx" // Il nome del file che verrà scaricato sul PC
            };

            // 4. Creiamo materialmente il file Spreadsheet in memoria
            var oSheet = new Spreadsheet(oSettings);

            // 5. Costruiamo il file e forziamo il browser a scaricarlo
            oSheet.build().finally(function () {
                // Puliamo la memoria dell'applicazione una volta finito il download (Best Practice!)
                oSheet.destroy();
            });
        },


        // ------------------------------------------------------------------------
        // MOTORE DI RICERCA (SearchField)
        // ------------------------------------------------------------------------
        onSearch: function (oEvent) {

            // 1. Intercettiamo le lettere esatte digitate dall'utente nella barra
            var sQuery = oEvent.getParameter("newValue");

            // 2. Prepariamo un Array vuoto che conterrà le nostre regole di ricerca
            var aFilters = [];

            // 3. Se c'è almeno una lettera scritta, attiviamo la logica di ricerca
            if (sQuery && sQuery.length > 0) {

                // Regola 1: Cerca se la colonna CustomerName CONTIENE la parola digitata
                var filterCustomer = new Filter("CustomerName", FilterOperator.Contains, sQuery);

                // Regola 2: Cerca se la colonna Product CONTIENE la parola digitata
                var filterProduct = new Filter("Product", FilterOperator.Contains, sQuery);

                // Uniamo le due regole. L'opzione "and: false" significa che basta che UNA delle due 
                // regole sia vera per mostrare il risultato (Ricerca in modalità OR).
                var combinedFilter = new Filter({
                    filters: [filterCustomer, filterProduct],
                    and: false
                });

                // Inseriamo la regola combinata nel nostro Array
                aFilters.push(combinedFilter);
            }

            // 4. Andiamo a "pescare" la Tabella dalla View tramite il suo ID
            var oTable = this.byId("ordersTable");

            // 5. Prendiamo il collegamento diretto tra la tabella e i dati (Binding)
            var oBinding = oTable.getBinding("items");

            // 6. Applichiamo il filtro! Le righe che non superano il test spariranno all'istante
            oBinding.filter(aFilters);
        },


        // ------------------------------------------------------------------------
        // GESTIONE CANCELLAZIONE ORDINE
        // ------------------------------------------------------------------------
        onDeleteOrder: function (oEvent) {

            // 1. Intercettiamo esattamente quale riga è stata cliccata usando il Binding Context
            var oItem = oEvent.getParameter("listItem");
            var sPath = oItem.getBindingContext("ordersModel").getPath(); // Es. ci restituisce "/Orders/3"

            // 2. Andiamo a prendere i dati completi
            var oModel = this.getView().getModel("ordersModel");
            var oData = oModel.getData();

            // 3. Ricaviamo il numero esatto della riga (indice). 
            // splittando "/Orders/3" con la barra "/", prendiamo l'ultimo pezzo, cioè il "3".
            var sIndex = sPath.split("/").pop();

            // 4. ELIMINAZIONE FISICA: Usiamo la funzione JavaScript "splice" che taglia via 
            // esattamente 1 elemento partendo dall'indice trovato.
            oData.Orders.splice(sIndex, 1);

            // 5. Segnaliamo al modello che i dati sono cambiati per forzare la View a ridisegnarsi
            oModel.refresh(true);
        },


        // ------------------------------------------------------------------------
        // POPUP CREAZIONE NUOVO ORDINE
        // ------------------------------------------------------------------------

        // Apre il Pop-up
        onOpenAddDialog: function () {
            this.byId("addOrderDialog").open();
        },

        // Chiude il Pop-up annullando l'operazione
        onCancelOrder: function () {
            this.byId("addOrderDialog").close();
        },

        // Logica di salvataggio del nuovo ordine
        onSaveOrder: function () {

            // 1. Recuperiamo tutti i testi scritti dall'utente nei campi di input del popup
            var sCustomer = this.byId("inputCustomer").getValue();
            var sProduct = this.byId("inputProduct").getValue();
            var sCategory = this.byId("inputCategory").getValue();
            var sQuantity = this.byId("inputQuantity").getValue();
            var sPrice = this.byId("inputPrice").getValue();

            // 2. Costruiamo il nuovo "oggetto" riga formattandolo correttamente per il JSON
            var oNewOrder = {
                // Generiamo un ID finto e casuale da 0 a 9999
                OrderID: "ORD-" + Math.floor(Math.random() * 10000),
                CustomerName: sCustomer,
                Product: sProduct,
                Category: sCategory,
                Quantity: parseInt(sQuantity, 10), // Forza la conversione in numero intero
                UnitPrice: parseFloat(sPrice),     // Forza la conversione in numero decimale
                Status: "In Lavorazione"           // Impostiamo lo stato di default per i grafici
            };

            // 3. Prendiamo il Database in memoria
            var oModel = this.getView().getModel("ordersModel");
            var oData = oModel.getData();

            // 4. Aggiungiamo il nuovo ordine CIMA alla lista usando la funzione unshift()
            oData.Orders.unshift(oNewOrder);

            // 5. Avvisiamo l'interfaccia che ci sono nuovi dati così mostra subito la riga
            oModel.refresh(true);

            // 6. PULIZIA DEL POPUP: Svuotiamo i campi per evitare che rimangano sporchi alla prossima apertura
            this.byId("inputCustomer").setValue("");
            this.byId("inputProduct").setValue("");
            this.byId("inputCategory").setValue("");
            this.byId("inputQuantity").setValue("");
            this.byId("inputPrice").setValue("");

            // 7. Chiudiamo il Pop-up
            this.byId("addOrderDialog").close();
        }

    });
});