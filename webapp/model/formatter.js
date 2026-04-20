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
        }
    };
});