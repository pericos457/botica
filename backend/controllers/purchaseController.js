const PDFDocument = require('pdfkit');
const purchaseService = require('../services/purchaseService');
require('pdfkit-table');


class PurchaseController {
  async getAllPurchases(req, res) {
    try {
      const purchases = await purchaseService.getAllPurchases();
      res.json(purchases);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error al obtener las compras' });
    }
  }

  async getPurchaseByCode(req, res) {
    try {
      const { cod_compra } = req.params;
      const purchase = await purchaseService.getPurchaseByCode(cod_compra);
      if (!purchase) {
        return res.status(404).json({ message: 'Compra no encontrada' });
      }
      res.json(purchase);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error al obtener la compra' });
    }
  }

  async createPurchase(req, res) {
    const { cliente_id, productos } = req.body;

    if (!cliente_id || !productos || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ message: 'Datos incompletos: Se requiere cliente_id y un array de productos con producto_id y cantidad.' });
    }

    for (const prod of productos) {
      if (!prod.producto_id || !prod.cantidad || typeof prod.cantidad !== 'number' || prod.cantidad <= 0) {
        return res.status(400).json({ message: `Producto inválido en la lista: ${JSON.stringify(prod)}. Se requiere producto_id y cantidad positiva.` });
      }
    }

    try {
      const cod_compra = `C-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const fecha_compra = new Date();

      const newPurchaseResult = await purchaseService.addPurchaseWithDetails({
        cod_compra,
        cliente_id,
        fecha_compra,
        productos
      });

      res.status(201).json({ message: 'Compra registrada con éxito', cod_compra, details: newPurchaseResult });

    } catch (error) {
      console.error('Error detallado en createPurchase Controller:', error);
      res.status(500).json({ message: error.message || 'Error interno al registrar la compra completa.' });
    }
  }

  async updatePurchase(req, res) {
    try {
      const { id } = req.params;
      const { cod_compra, cliente_id, producto_id, cantidad, fecha_compra } = req.body;

      const updatedPurchase = await purchaseService.modifyPurchase(id, {
        cod_compra,
        cliente_id,
        producto_id,
        cantidad,
        fecha_compra,
      });

      if (!updatedPurchase) {
        return res.status(404).json({ message: 'Compra no encontrada' });
      }

      res.json(updatedPurchase);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error al actualizar la compra' });
    }
  }

  async deletePurchase(req, res) {
    try {
      const { id } = req.params;
      await purchaseService.removePurchase(id);
      res.sendStatus(204);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error al eliminar la compra' });
    }
  }

  async getPurchaseDetails(req, res) {
    try {
      const { productName, clientDni } = req.query;
      const filters = {};
      if (productName) filters.productName = productName;
      if (clientDni) filters.clientDni = clientDni;

      console.log("Filtros recibidos en getPurchaseDetails Controller:", filters);

      const details = await purchaseService.getPurchaseDetails(filters);
      res.json(details);
    } catch (error) {
      console.error("Error en getPurchaseDetails Controller:", error);
      res.status(500).json({ message: 'Error al obtener los detalles de las compras' });
    }
  }

async generatePDF(req, res) {
  try {
    const { productName, clientDni } = req.query;
    const filters = {};

    if (productName) filters.productName = productName;
    if (clientDni) filters.clientDni = clientDni;

    const purchases = await purchaseService.getPurchaseDetails(filters);

    if (!purchases || purchases.length === 0) {
      return res.status(404).json({ message: 'No hay compras para generar el reporte.' });
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Disposition', 'attachment; filename="reporte_compras.pdf"');
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text('Reporte de Compras', { align: 'center' });
    doc.moveDown(2); // espacio más grande debajo del título

    const headers = [
      'Fecha',
      'Cliente',
      'DNI',
      'Producto',
      'Precio Unitario',
      'Cantidad',
      'Subtotal'
    ];

    const columnWidths = [70, 100, 60, 90, 80, 50, 80];
    const startX = doc.x;
    let y = doc.y;

    doc.fontSize(10).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.text(header, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), y, {
        width: columnWidths[i],
        align: 'left'
      });
    });

    y += 25; // espacio después de headers
    doc.font('Helvetica');

    let total = 0;

    for (const item of purchases) {
      const row = [
        new Date(item.fecha_compra).toLocaleDateString(),
        `${item.cliente_nombre} ${item.cliente_apellido_pat}`,
        item.cliente_dni,
        item.producto_nombre,
        `S/ ${Number(item.producto_precio).toFixed(2)}`,
        item.cantidad.toString(),
        `S/ ${(Number(item.producto_precio) * item.cantidad).toFixed(2)}`
      ];

      row.forEach((text, i) => {
        doc.text(text, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), y, {
          width: columnWidths[i],
          align: 'left'
        });
      });

      total += Number(item.producto_precio) * item.cantidad;

      // Espacio adicional debajo del cliente
      y += 28;

      // Salto de página si se pasa del límite visual
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 50;
      }
    }

    doc.moveTo(startX, y + 10).lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), y + 10).stroke();
    doc.font('Helvetica-Bold').fontSize(12).text(`Total General: S/ ${total.toFixed(2)}`, startX, y + 20, {
      align: 'right',
      width: 500
    });

    // Pie de página con fecha
    const footerText = `Reporte generado el ${new Date().toLocaleString()}`;
    doc.fontSize(8).font('Helvetica-Oblique').text(footerText, 40, doc.page.height - 40, {
      align: 'center',
      width: doc.page.width - 80
    });

    doc.end();
  } catch (error) {
    console.error('Error al generar el PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error al generar el PDF' });
    }
  }
}


}

module.exports = new PurchaseController();
