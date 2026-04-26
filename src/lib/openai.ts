// OpenAI Integration for Impulse AI

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "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";

export async function askImpulseAI(message: string, context: { totalBilled: number, totalCost: number, invoices: any[], expenses: any[] }): Promise<{ text: string, action?: any }> {
  const recentInvoices = context.invoices.slice(0, 50); 
  const invoiceSummaries = recentInvoices.map(inv => 
    `- ID: ${inv.id} - Cliente: ${inv.clientName || 'Sin Nombre'} - Total: $${inv.total} - Estado: ${inv.status} - Color: ${inv.color || 'blue'}
     Productos: ${inv.items ? inv.items.map((i: any) => `${i.quantity}x ${i.description} (Venta: $${i.salePrice}, Costo: $${i.costPrice})`).join(', ') : 'Ninguno'}`
  ).join("\n");

  const recentExpenses = context.expenses.slice(0, 30);
  const expenseSummaries = recentExpenses.map(exp =>
    `- Gasto: ${exp.description} - Valor: $${exp.amount} - Categoría: ${exp.category} - Fecha: ${exp.date}`
  ).join("\n");

  const systemPrompt = `Eres Impulse AI, el asistente financiero inteligente de Impulse Ultra.
Tu misión es analizar los datos del usuario para proporcionar insights valiosos, consejos y responder preguntas.
Además, PUEDES EJECUTAR ACCIONES en el sistema si el usuario te lo pide.

DATOS FINANCIEROS REALES DEL USUARIO:
- Facturación Total: $${context.totalBilled}
- Costos de Productos: $${context.totalCost}
- Gastos Operativos: $${context.expenses.reduce((acc, curr) => acc + Number(curr.amount), 0)}
- Balance Neto: $${context.totalBilled - context.totalCost - context.expenses.reduce((acc, curr) => acc + Number(curr.amount), 0)}

RESUMEN DE CUENTAS DE COBRO/FACTURAS (Últimas 50):
${invoiceSummaries || "Sin ventas recientes."}

RESUMEN DE GASTOS RECIENTES (Últimos 30):
${expenseSummaries || "Sin gastos recientes."}

REGLAS DE ORO:
1. Sé directo, profesional y MUY fluido.
2. NUNCA uses asteriscos (*) ni numerales (#) para dar formato al texto. Usa guiones (-) para listas y mayúsculas para resaltar.
3. Si el usuario te pide MODIFICAR una cuenta de cobro (ej. cambiar a cotización, marcar como pagada, cambiar color, modificar productos, precios o cantidades) DEBES usar la función \`update_invoice\`.
4. Si el usuario te pide COMPARTIR una cuenta de cobro o factura por WhatsApp o abrir la ventana de compartir del dispositivo, DEBES usar la función \`share_invoice\`.
5. Si no encuentras la cuenta de cobro exacta, pídele al usuario más detalles.
6. Si llamas a una función, también proporciona un breve mensaje de confirmación en texto.`;

  const tools = [
    {
      type: "function",
      function: {
        name: "update_invoice",
        description: "Actualiza los datos de una cuenta de cobro o factura específica.",
        parameters: {
          type: "object",
          properties: {
            invoiceId: { type: "string", description: "El ID exacto de la factura a modificar (sacado del resumen de facturas)." },
            updates: {
              type: "object",
              description: "Los campos a actualizar. Solo incluye los que cambian.",
              properties: {
                status: { type: "string", enum: ["PENDIENTE", "PAGADO", "ABONO", "COTIZACIÓN"], description: "El nuevo estado." },
                color: { type: "string", enum: ["blue", "purple", "emerald", "rose", "amber", "orange", "zinc"], description: "El nuevo color de la factura." },
                items: {
                  type: "array",
                  description: "La lista completa de productos actualizada si se solicitó un cambio en productos, cantidades o precios.",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      description: { type: "string" },
                      quantity: { type: "number" },
                      salePrice: { type: "number" },
                      costPrice: { type: "number" }
                    },
                    required: ["id", "description", "quantity", "salePrice", "costPrice"]
                  }
                }
              }
            }
          },
          required: ["invoiceId", "updates"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "share_invoice",
        description: "Abre la ventana de compartir nativa del dispositivo para una factura específica.",
        parameters: {
          type: "object",
          properties: {
            invoiceId: { type: "string", description: "El ID exacto de la factura a compartir." }
          },
          required: ["invoiceId"]
        }
      }
    }
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": \`Bearer \${OPENAI_API_KEY}\`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        tools: tools,
        tool_choice: "auto",
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API Error:", errorData);
      throw new Error("Error de comunicación con Impulse AI");
    }
    
    const data = await response.json();
    const responseMessage = data.choices[0].message;
    
    let action = undefined;
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      action = {
        name: toolCall.function.name,
        arguments: JSON.parse(toolCall.function.arguments)
      };
    }

    return {
      text: responseMessage.content || "Acción procesada con éxito.",
      action
    };
  } catch (error) {
    console.error("AI Chat Error:", error);
    return { text: "Lo siento, hubo un problema al conectar con mi cerebro artificial. ¿Podrías intentar de nuevo?" };
  }
}

export async function scanDocumentWithAI(base64Image: string) {
  const systemPrompt = `Analiza la imagen de esta factura o recibo. Extrae los datos necesarios para registrar un gasto.
IMPORTANTE PARA EL PRECIO (Moneda Colombiana): Si el precio total tiene decimales separados por coma (ej. 1500,50), elimina la coma y los dos decimales finales. Devuelve siempre un número entero. Asegúrate de extraer también todos los productos detallados en la lista.

Devuelve los datos ESTRICTAMENTE en este formato JSON:
{
  "description": "Nombre del proveedor o tienda",
  "amount": valor_total_entero_sin_puntos_ni_comas,
  "category": "Una de: GASTO_OPERATIVO, INVERSION_OPERATIVA, NOMINA, MANTENIMIENTO, SERVICIOS, OTROS",
  "tax": valor_del_impuesto_o_iva_si_existe_0_si_no,
  "products": "Lista de productos comprados separada por comas, incluyendo todos los detalles posibles",
  "date": "YYYY-MM-DD"
}

Si no encuentras la fecha, usa la fecha de hoy. Si no encuentras impuestos, pon 0.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemPrompt },
              {
                type: "image_url",
                image_url: {
                  url: base64Image
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI Scan Error:", errorData);
      throw new Error("No pude leer la factura. Intenta con una foto más clara.");
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Clean up content if it comes with markdown code blocks
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("AI Scan Error:", error);
    throw error;
  }
}
