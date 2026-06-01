sap.ui.define([], function () {
    "use strict";

    return {
        // ------------------------------------------------------------------------
        // 1. FORMATTAZIONE VALUTA
        // Prende il numero puro dal server e restituisce la stringa pulita con i decimali e il simbolo
        // ------------------------------------------------------------------------
        currencyValue: function (sValue) {
            if (!sValue) {
                return "0.00 €";
            }
            // Converte in decimale e fissa a 2 cifre dopo la virgola, poi aggiunge l'Euro
            return parseFloat(sValue).toFixed(2) + " €";
        },

        // ------------------------------------------------------------------------
        // 2. FORMATTAZIONE COLORE STATO (ObjectStatus state)
        // ------------------------------------------------------------------------
        statusState: function (sStatus) {
            // Controlliamo cosa ci manda il backend e decidiamo il colore (Success=Verde, Error=Rosso, Warning=Arancione)
            if (sStatus === "Completato" || sStatus === 1) {
                return "Success";
            } else if (sStatus === "Cancellato" || sStatus === "Annullato" || sStatus === 4) {
                return "Error";
            } else {
                return "Warning"; // Tutto il resto (es. In lavorazione) sarà arancione
            }
        },

        // ------------------------------------------------------------------------
        // 3. FORMATTAZIONE ICONA STATO (ObjectStatus icon)
        // ------------------------------------------------------------------------
        statusIcon: function (sStatus) {
            if (sStatus === "Completato" || sStatus === 1) {
                return "sap-icon://sys-enter-2"; // Spunta verde
            } else if (sStatus === "Cancellato" || sStatus === "Annullato" || sStatus === 4) {
                return "sap-icon://error"; // X rossa
            } else {
                return "sap-icon://in-progress"; // Orologio arancione
            }
        },

        // ------------------------------------------------------------------------
        // 4. FORMATTAZIONE EURO ITALIANO (es. 20.000,00 €)
        // ------------------------------------------------------------------------
        formatItalianEuro: function (sValue) {
            if (!sValue) { 
                return "0,00 €"; 
            }
            const fValue = parseFloat(sValue);
            if (isNaN(fValue)) {
                return "0,00 €";
            }
            const sFormattedNumber = fValue.toLocaleString('it-IT', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
            return sFormattedNumber + " €";
        },

        // ------------------------------------------------------------------------
        // 5. FORMATTAZIONE DATA (gg/mm/aaaa)
        // ------------------------------------------------------------------------
        formatItalianDate: function (oDate) {
            // Se la data è nulla o vuota, restituisce una stringa vuota per non far crashare la tabella
            if (!oDate) {
                return "";
            }

            // Assicuriamoci che sia un oggetto Date valido
            const d = new Date(oDate);
            
            // Se la conversione fallisce, restituiamo il dato grezzo
            if (isNaN(d.getTime())) {
                return oDate;
            }

            // Estraiamo giorno, mese e anno forzando i due zeri (es. 05 invece di 5)
            const day = d.getDate().toString().padStart(2, '0');
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const year = d.getFullYear();

            // Restituiamo il formato gg/mm/aaaa
            return day + "/" + month + "/" + year;
        }
    };
});