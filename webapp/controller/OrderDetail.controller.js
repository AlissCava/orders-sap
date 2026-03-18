sap.ui.define([
    "orders/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox"
], function (BaseController, JSONModel, MessageBox) {
    "use strict";

    return BaseController.extend("orders.controller.OrderDetail", {

        onInit: function () {
            // Creiamo il modello locale
            const oDetailModel = new JSONModel();
            this.getView().setModel(oDetailModel, "detailModel");

            this.getRouter().getRoute("RouteOrderDetail").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
            const sOrderId = oEvent.getParameter("arguments").orderId;
            const iOrderId = parseInt(sOrderId);
            
            const oODataModel = this.getModel();
            const oDetailModel = this.getView().getModel("detailModel");

            // Svuotiamo il modello prima di caricare i nuovi dati
            oDetailModel.setData({});

            // Il payload speciale per forzare la Read tramite una Create (Operation: R)
            const oReadPayload = {
                "Operation": "R",
                "NumOrdine": iOrderId,
                "ZET_lista_ordini": {
                    "NumOrdine": iOrderId,
                    "Cliente": "",
                    "DataOrdine": new Date(),
                    "ImportoTot": 0,
                    "Stato": 0
                },
                "ZET_dettagli_ordiniSet": []
            };

            sap.ui.core.BusyIndicator.show(0);

            // Chiamata di test
            oODataModel.create("/ZES_DeepOrdiniSet", oReadPayload, {
                success: function (oData) {
                    sap.ui.core.BusyIndicator.hide();
                    
                    // Estraiamo gli articoli (questo è il pezzo che dobbiamo correggere 
                    // in base a quello che vedremo nella console)
                    let aArticles = []; // Usiamo let perché il valore cambia qui sotto
                    if (oData.ZET_dettagli_ordiniSet && oData.ZET_dettagli_ordiniSet.results) {
                        aArticles = oData.ZET_dettagli_ordiniSet.results;
                    } else if (Array.isArray(oData.ZET_dettagli_ordiniSet)) {
                        aArticles = oData.ZET_dettagli_ordiniSet;
                    }

                    // Impacchettiamo i dati puliti per l'XML
                    // Lasciamo le chiavi in italiano per non rompere il binding con l'XML!
                    const oCleanData = {
                        Cliente: oData.ZET_lista_ordini ? oData.ZET_lista_ordini.Cliente : "",
                        ImportoTot: oData.ZET_lista_ordini ? oData.ZET_lista_ordini.ImportoTot : 0,
                        NumOrdine: oData.NumOrdine,
                        StatoTxt: oData.ZET_lista_ordini ? oData.ZET_lista_ordini.StatoTxt : "",
                        Articoli: aArticles
                    };

                    oDetailModel.setData(oCleanData);
                },
                error: function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error("Errore durante la lettura dell'ordine da SAP.");
                }
            });
        },

        onNavBack: function () {
            this.getRouter().navTo("RouteHome", {}, true);
        }
    });
});