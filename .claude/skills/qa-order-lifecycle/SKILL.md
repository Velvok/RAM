---
name: qa-order-lifecycle
description: Checklist y procedimiento para hacer QA end-to-end del ciclo de vida completo de un pedido en Velvok/RAM (entrada EVO → aprobación → corte/preparación → reasignación → entrega). Úsala cuando el usuario pida "probar el flujo de pedidos", "hacer QA de recortes/cortes/stock", "verificar límites de la app" o similar en este repo. NO la uses para bugs puntuales ya identificados (ve directo al fix) ni para cambios de UI/UX sin relación con la lógica de negocio del pedido.
---

# QA del ciclo de vida del pedido (Velvok/RAM)

## Por qué existe esta skill

El flujo de un pedido atraviesa muchos módulos (aprobación, stock, corte, preparación,
reasignación, remanentes, entrega) repartidos en varios archivos con guards inconsistentes
entre sí. Esta skill documenta el mapa completo para no tener que re-explorarlo cada vez, y
deja un checklist vivo de los huecos conocidos para que cada ronda de QA los vuelva a
verificar (y añada los nuevos que encuentre).

**Antes de cualquier ejecución real, lee la sección "Riesgo EVO" — es el punto más
importante de toda la skill.**

## Riesgo EVO (leer primero, siempre)

El sistema **no es de solo lectura hacia EVO**. `lib/ram-outbound.ts` implementa un patrón
Outbox que hace **POST HTTP reales** al ERP EVO del cliente (`EVO_API_URL` en `.env.local`,
sin indicios de ser un sandbox por el nombre de host) cuando:

- Se corta una chapa con remanente real o en modo "exacto" con `evo_order_id` mapeado
  (`notifyCorteRealizado`/`notifyChapaPreparada`, `app/actions/cut-operations.ts:227-241,386-396`).
- Se prepara un artículo/accesorio (`prepareItem`, `app/actions/preparation.ts:161-169` —
  **el POST a EVO se encola ANTES de tocar la BD local**, línea 159).
- Se confirma una recogida reasignada (`confirmReassignmentPickup`,
  `app/actions/confirm-reassignment.ts:89-141`, hasta 2 eventos).
- Se marca un pedido como entregado manualmente (`markOrderAsDelivered` →
  `notifyPedidoCompletado`, `app/actions/orders.ts:795-801`).

**Regla de trabajo:**
- Para probar el **camino feliz real** (aprobar/cortar/preparar/reasignar/entregar) con
  pedidos de verdad entrados desde EVO: solo hacerlo si el usuario ha dado luz verde
  explícita sabiendo que esto puede generar tráfico real hacia el EVO de producción. Si no
  la ha dado, pregunta antes de ejecutar nada que toque estos caminos.
- Para probar **guards/límites rotos** (sobre-cortar, saltarse topes de reasignación, volver
  a cortar algo ya completado, etc.): usar siempre un **pedido sintético propio**, creado sin
  `evo_order_id` y sin vínculo a EVO, para que estos experimentos deliberadamente "rotos" no
  generen eventos reales hacia el ERP del cliente ni corrompan datos de pedidos reales.
  `notifyCorteRealizado`/`notifyChapaPreparada` solo disparan si hay `evo_order_id`/`ref_evo`/
  `evo_product_id` — un pedido sin esos campos nunca toca EVO aunque se corte de verdad.
- La fase "entregado" en producción solo llega por el webhook real
  `app/api/webhooks/pedidos/entregado/route.ts` cuando EVO genera el remito. Para cerrar el
  ciclo en un QA sin esperar a EVO, **simula tú mismo ese webhook llamándolo directamente**
  (es tráfico entrante hacia tu propio endpoint, replicando lo que EVO enviaría — no afecta al
  EVO real). Construye el payload/headers leyendo `lib/webhook-security.ts` y el propio route.

## Convenciones de ejecución

- Toda mutación de verificación en BD va en un script `scripts/_tmp-*.mjs` (usa
  `createClient` de `@supabase/supabase-js` con `SUPABASE_SERVICE_ROLE_KEY`, ejecútalo con
  `node --env-file=.env.local scripts/_tmp-*.mjs`), y se borra al terminar la sesión de QA.
- Cualquier dato sintético creado para romper guards (pedidos, operadores de prueba) se limpia
  por completo al terminar: `orders`/`order_lines`/`cut_orders`/`cut_lines`/`stock_movements`
  asociados, y se revierte cualquier `inventory.stock_reservado`/`stock_total` que se haya
  tocado. Nunca dejar un pedido sintético ni un operario "QA Test" abandonado en producción.
- Para pruebas de planta (PIN), crea un operador temporal con `createOperatorWithPin` (o
  insert directo con `bcryptjs`) en vez de usar el PIN de un operario real — bórralo al
  terminar.
- Un solo agente/sesión debe controlar el navegador Chrome a la vez. Si vas a lanzar un fork
  para ejecutar pasos por UI, no toques tú mismo el navegador en paralelo — espera a que
  termine, o reparte el trabajo en "UI" vs "scripts de BD" sin solaparse.
- Login admin real para pruebas: `info@velvok.com` / la contraseña vigente (ver memoria del
  proyecto o preguntar). Login planta: PIN del operador temporal que hayas creado.

## Mapa del ciclo de vida

Estados reales de `orders.status` (constraint en
`supabase/migrations/00035_update_orders_status_check.sql:11`, idéntico a
`lib/order-status.ts:4-11`): `nuevo | aprobado | aprobado_en_pausa | en_corte | finalizado |
entregado | cancelado`.

| Transición | Función | Archivo |
|---|---|---|
| EVO → `nuevo` | `processPedidoNuevo` | `app/api/webhooks/pedidos/nuevo/route.ts:215-399` |
| `nuevo` → `aprobado` | `approveOrder` | `app/actions/orders.ts:223-503` |
| `nuevo` → `aprobado_en_pausa` | `approveOrderOnHold` | `app/actions/orders.ts:93-220` |
| `aprobado_en_pausa` → `aprobado` (auto, al completar asignación de stock) | `checkAndActivateOrderOnHold` | `app/actions/stock-management.ts:211-259` |
| `aprobado`/`aprobado_en_pausa` → `en_corte` → `finalizado` (auto, según progreso) | `updateOrderStatus` | `app/actions/orders.ts:514-589` |
| `en_corte`/`finalizado` → `entregado` (remito real) | webhook | `app/api/webhooks/pedidos/entregado/route.ts:120-401` |
| `en_corte`/`finalizado` → `entregado` (manual, sin botón en UI) | `markOrderAsDelivered` | `app/actions/orders.ts:595-811` |
| `entregado` → estado anterior | `undoOrderDelivery` | `app/actions/orders.ts:817-935` |
| cualquiera → `cancelado` (sin botón en UI) | `cancelOrder` | `app/actions/orders.ts:60-88` |

Corte: `cut_orders.status` = `pendiente | completada | pendiente_confirmacion`
(`lib/cut-order-status.ts`). Reasignación activa: `app/actions/stock-management.ts:780-987`
(entre pedidos, con guards) + confirmación en `app/actions/confirm-reassignment.ts:11-233`.
Cambio de tamaño/material de una línea: `app/actions/reassign-stock.ts` (sin guards de
servidor — ver checklist). Remanentes: `app/actions/remnants.ts` +
`generateRemnantStock` (`app/actions/stock-management.ts:559-728`).

**Código muerto, no lo uses como referencia de flujo real:** `app/actions/reassignments.ts`
(`reassignCutOrder`/`revertReassignment`, cero imports en el resto del repo, escribe
`status: 'desarmado'` y columnas que no existen en ninguna migración — rompería en runtime si
se invocara), `app/api/webhooks/evo/route.ts` (usa `status: 'ingresado'`, no existe en el
enum real), `finishCutOrder` en `app/actions/cut-orders.ts:131-241` (no usada desde
`cut-operations.ts` actualmente, la lógica de consumo de stock está comentada).

## Checklist de guards (vivo — marca y añade hallazgos en cada ronda)

### Guards que deben seguir funcionando (regresión)
- [ ] `approveOrder` rechaza aprobar algo que no esté en `nuevo`.
- [ ] `approveOrder` bloquea la aprobación completa si falta stock en cualquier línea
      (sugiere pausa).
- [ ] `approveOrderOnHold` igual, sin chequeo de stock.
- [ ] `prepareItem` rechaza `cantidad_preparada > quantity_requested`.
- [ ] `createPreparationItem`/`assignStockToPreparationItem` rechazan reservar más de lo
      disponible.
- [ ] `stock-management.reassignStock` (reasignar corte completo entre pedidos) rechaza:
      origen sin `material_base_id`, `quantity_cut <= 0`, `quantity_cut < quantityToReassign`,
      destino `completada`/`entregado`.
- [ ] `confirmReassignmentPickup` exige `status === 'pendiente_confirmacion'`.
- [ ] Webhook `pedido_entregado` exige `order.status` en `en_corte`/`finalizado`.
- [ ] Webhooks entrantes exigen Bearer token válido + idempotencia por `id_evento`.

### ⚠️ Lección de método (error real cometido en esta sesión — leer antes de declarar nada "crítico")

En la primera pasada de esta ronda, dos hallazgos se marcaron como "🔴 críticos en producción"
y **ambos resultaron ser lecturas apresuradas**, corregidas después de que el usuario preguntara
"¿te has fijado si llegan confirmaciones y actualizaciones de stock después?". El error en ambos
casos fue el mismo: **medir el estado de la base de datos inmediatamente después de una acción
que dispara un evento asíncrono hacia EVO, sin esperar ni comprobar si la confirmación/sincronización
posterior llega y lo resuelve.**

- Se creyó que un corte real con remanente nunca acreditaba el stock, porque justo después del
  corte `inventory.stock_total` del remanente no había cambiado. En realidad, EVO confirma el
  evento y **15-45 segundos después** envía un webhook `stock_actualizado`
  (`app/api/webhooks/stock/actualizado/route.ts`) que sí lo acredita — comprobado comparando el
  valor antes/después en el histórico de `evo_events` (tipo `stock_actualizado`): pasó de
  -8489,5 a -8479,5, exactamente +10, el remanente generado. El código no necesita llamar a
  `generateRemnantStock()` en el flujo activo porque **EVO es la fuente de verdad y sincroniza
  solo**; esa función pertenece a un camino de corte que ya no se usa, y no llamarla ahí no es
  un bug.
- Se creyó que un evento PREP con cantidad negativa (lado "origen" de una reasignación) nunca
  se confirma, porque a los pocos minutos seguía en `processing`. Revisando el histórico
  **completo** de `outbound_events` (no solo el de esta sesión): de 11 eventos con cantidad
  negativa en toda la vida del sistema, 9 se confirmaron (`status: success`), 2 fallaron a nivel
  HTTP, y **ninguno sigue atascado hoy** — la tasa de confirmación de negativos (82%) es
  equivalente a la de positivos (79%, 173/218). El caso observado llevaba atascado solo 15-20
  minutos cuando se dio por perdido, y la fila se borró al revertir el pedido de prueba antes de
  poder confirmar si acabó llegando la confirmación.

**Regla para la próxima vez**: antes de calificar cualquier observación relacionada con EVO
(stock que no cambia, evento que no se confirma, dato que no cuadra) como un bug, comprobar
primero (a) si existe un mecanismo asíncrono posterior que lo resuelva (`stock_actualizado`,
`/api/webhooks/evo/confirmacion`) y darle tiempo/consultarlo, y (b) el histórico completo de
`evo_events`/`outbound_events` para ese producto o tipo de evento, no solo la observación de
esta sesión — un número que parece anómalo puede llevar meses así (ver "Para negocio, no para
código" más abajo) y no tener nada que ver con la prueba que se acaba de hacer.

### 🔵 Para negocio, no para código

`AC25110.1,0` (y varios productos de la familia `TG22110`) tienen `stock_total`/`stock_disponible`
negativo de forma **estable desde julio de 2026** según el propio EVO (confirmado recorriendo
los 94 eventos `stock_actualizado` históricos) — no es un bug de RAM, es el dato que EVO reporta
como autoritativo. Vale la pena preguntar a EVO/contabilidad si ese saldo es conocido o merece
investigarse, pero no es tarea de esta skill ni se arregla con un cambio de código aquí.

### Huecos conocidos (confirmados por lectura de código a 2026-10-14, re-verificar con
pedido sintético en cada ronda — **no en pedidos reales**)
1. **Sobre-corte**: `processCutOrder` (`app/actions/cut-operations.ts:124-146`) no valida
   que `quantity_cut` resultante no exceda `quantity_requested`, ni que la `cut_order` no esté
   ya `completada`. Se puede volver a cortar algo terminado.
2. **Cambio de tamaño sin tope en servidor**: `reassign-stock.ts` solo valida
   `quantityForNewMaterial <= quantity_requested` en el cliente
   (`app/admin/pedidos/[id]/order-detail-client.tsx:800-803`); el servidor no lo repite, ni
   valida el `status` de la `cut_order` destino.
3. `startCutOrder` (`app/actions/cut-orders.ts:74-109`) no valida el estado previo.
4. `cancelOrder` no valida estado previo (se puede cancelar un pedido `entregado`) y no tiene
   botón en UI.
5. `markOrderAsDelivered` no valida `order.status` antes de entregar (solo que los items
   estén completos); no tiene botón en UI.
6. `undoOrderDelivery` promete ventana de 24h en comentarios/UI pero no la implementa.
7. La UI referencia un estado `parcialmente_entregado`
   (`app/admin/pedidos/[id]/order-detail-client.tsx:157,159,168,169`) que no existe en el
   constraint real de BD; una entrega parcial vía webhook nunca cambia `orders.status`.
8. `remnants.ts` no tiene máquina de estados server-side (se puede `useRemnant` algo ya
   `descartado`, etc.).
9. RPC `rollback_order` (usado al reprocesar un `pedido_creado` modificado,
   `app/api/webhooks/pedidos/nuevo/route.ts:234-241`) no está en ninguna migración
   versionada — riesgo de fallo si no existe ya manualmente en la BD.
10. `approveOrder` no es transaccional: si falla a mitad de la segunda pasada puede dejar
    `cut_orders`/`preparation_items` huérfanos sin que el pedido quede aprobado.
11. `finishCutOrder` fuerza `quantity_cut` directamente sin comparar contra el valor previo
    (podría "desactualizarlo" si se llama con un valor menor).
12. Se observaron valores de `inventory.stock_disponible` **negativos** en varios productos
    de la familia `TG22110` en producción (p. ej. `TG22110.13,0: -6`, `TG22110.6,5: -19`) —
    indica que `stock_reservado`/`stock_en_proceso` ya superaba `stock_total` antes de
    cualquier prueba de esta skill. No está causado por el QA; repórtalo aparte si lo vuelves
    a ver, es una señal de que hay una fuga de reserva de stock en producción.

## Procedimiento de una ronda de QA

### Fase A — Camino feliz con pedidos reales (requiere luz verde explícita sobre riesgo EVO)
1. Elegir 2-3 pedidos reales recién entrados en `nuevo`, variados (alguno con solo chapa,
   alguno con chapa + accesorio, preferiblemente compartiendo algún producto entre sí para
   poder probar reasignación entre ellos).
2. Aprobar cada uno desde admin. Verificar creación de `cut_orders`/`preparation_items` y
   reserva de stock.
3. Cortar las chapas y preparar los accesorios desde planta.
4. Probar reasignación de stock cortado entre dos de los pedidos (mientras el destino siga
   sin completar) y confirmarla. **Importante (confirmado en la ronda de 2026-10-14): el
   botón "Reasignar" aparece en la fila del cut_order DESTINO (el que sigue `pendiente` y
   necesita stock), no en la del origen ya cortado.** Se abre un modal que lista pedidos con
   cut_orders `completada` del mismo producto como posibles orígenes. La confirmación de
   recogida (`confirmReassignmentPickup`, la que dispara el PREP real a EVO) se hace después
   desde la pantalla de planta del pedido destino, no desde admin.
5. Si queda alguna línea de chapa sin cortar todavía, probar el cambio de tamaño/material.
6. Para el pedido que quede 100% completo, simular el webhook `pedido_entregado` (entrega
   completa) y verificar `status → entregado`, liberación de `stock_reservado`, registro en
   `delivery_history`.
7. Revisar visualmente en el navegador que el dashboard/listados reflejan todo correctamente.

### Fase B — Romper guards con un pedido sintético (sin tocar EVO)
> ⚠️ Con este usuario/proyecto: **no generar pedidos sintéticos ni usar "Generar Pedido de
> Prueba"** salvo que lo pida explícitamente — usar siempre pedidos reales de EVO y revertir
> el estado después (ver "Historial de ejecuciones"). Esta fase queda como referencia de la
> técnica por si algún día se autoriza de nuevo, pero el procedimiento por defecto ahora es
> ejecutar estos mismos pasos sobre un pedido real y repararlo al terminar.

1. Crear un pedido sintético (`status: 'nuevo'`, sin `evo_order_id`) con una línea de una
   chapa cuyo tamaño exacto tenga stock 0 pero exista stock de un tamaño mayor en la misma
   familia (fuerza un corte real con remanente, no un "match exacto").
2. Aprobarlo y cortarlo normalmente una vez (camino feliz del pedido sintético).
3. Intentar violar cada hueco de la lista de arriba uno por uno (sobre-cortar, re-cortar algo
   `completada`, cambiar tamaño por encima de lo pedido, reasignar desde/hacia estados
   indebidos) y documentar si el sistema lo permite o lo bloquea.
4. Limpiar todo: pedido, líneas, cut_orders/cut_lines, stock_movements asociados, y revertir
   cualquier `inventory.stock_total`/`stock_reservado` tocado.

### Cierre
- Actualizar el checklist de huecos conocidos arriba (añadir lo nuevo, tachar lo que ya se
  arregló).
- Reportar al usuario: qué se probó, qué pasó, qué es bug real vs. comportamiento esperado,
  y una lista priorizada de qué arreglar primero (los huecos que pueden mandar datos
  incorrectos a EVO son los más urgentes).

## Historial de ejecuciones

- 2026-10-14 (continuación): el usuario pidió explícitamente **no usar nunca "Generar Pedido
  de Prueba"** (ni ningún pedido sintético) — todas las pruebas, incluidas las más agresivas
  (forzar remanente, romper guards), deben hacerse sobre los 5 pedidos reales entrados desde
  EVO que ya están en el sistema para eso. Esto **anula** cualquier recomendación anterior de
  esta skill de usar un pedido sintético para la Fase B — a partir de ahora, con este usuario,
  usar siempre pedidos reales y reparar/revertir el estado tras cada prueba (ver más abajo). Se
  resetearon por completo los 3 pedidos de la primera ronda (`100042954`/`100042952`/
  `100042951`) a estado `nuevo` — incluyendo restaurar `evo_data` original quando el webhook de
  entrega lo había sobrescrito (hallazgo menor aparte: el webhook `pedido_entregado` pisa
  `orders.evo_data` en vez de fusionarlo, perdiendo el payload original de `pedido_creado`) — y
  se repitió la prueba de remanente real sobre `100042952`, encontrando los dos hallazgos
  críticos 0a/0b de la sección de arriba. Al revertir, se olvidó inicialmente liberar la
  reserva de `TH2` al borrar un `preparation_item` directamente por SQL — **lección: al
  revertir manualmente un pedido completo, repasar la reserva de CADA producto de sus líneas,
  no solo el que se estaba probando**, idealmente con un script de verificación antes/después
  en vez de confiar en la memoria de qué se tocó.
- 2026-10-14: primera versión de la skill, creada junto con la primera ronda de QA real
  (pedidos EVO `100042954`/`100042952`/`100042951` para la Fase A). Ver el informe de esa
  sesión para el detalle de resultados.
- 2026-10-14: el usuario, preguntado explícitamente, decidió **no** usar un pedido sintético
  para la Fase B (romper guards) y hacer también esas pruebas sobre los mismos 3 pedidos
  reales de EVO de la Fase A, aceptando el riesgo de corromper datos reales y de generar
  eventos incorrectos hacia EVO. La recomendación por defecto de esta skill (usar un pedido
  sintético para la Fase B) **sigue siendo la correcta para rondas futuras** — esto fue una
  excepción explícita de esta sesión, no un cambio de política. Si se repite esta elección,
  recordar: reparar el estado de BD de cada pedido real tras cada hallazgo confirmado (dejarlo
  en el valor correcto) antes de seguir con el resto del flujo de ese pedido, y detenerse a
  pedir permiso si alguna reparación es bloqueada por el clasificador de permisos en vez de
  dejar el pedido en un estado inconsistente.
- 2026-10-14, resultado de la ronda con pedidos reales `100042954`/`100042952`/`100042951`
  (todos con chapa `AC25110.10,0`, dos con accesorio `TH2`):
  - **Login admin cambiado a mitad de sesión**: la contraseña fijada antes en esta misma
    sesión (`admin1`) ya no era válida al retomar — alguien la cambió a `admin123` en algún
    punto. Siempre confirmar la contraseña vigente con el usuario antes de asumir una de un
    registro anterior.
  - **Trampa de PIN de operador QA**: se creó un operador temporal con PIN `135790` para
    probar planta, pero ese PIN coincidió por casualidad con el de un operario real
    (`Juan Pérez`) y el login entró con su identidad real (`loginWithPin` itera y devuelve el
    primer match). Se detectó por el nombre mostrado en pantalla, se cerró sesión
    inmediatamente y se cambió el PIN del operador QA a uno no trivial. **Lección: no usar
    PINs con patrones obvios (secuencias, pares) para el operador de pruebas — generar algo
    no adivinable.** Efecto secundario inocuo: el `last_login_at` real de Juan Pérez quedó
    actualizado con la hora de esta prueba.
  - **Guard "cambiar tamaño sin tope" (hueco #2)**: confirmado que el cliente SÍ bloquea
    (toast "La cantidad no puede exceder lo solicitado (9)") al intentar asignar 15 a una
    cut_order de 9. No se intentó saltar el cliente para forzar el servidor — queda confirmado
    como hueco de código (sin guard de servidor) pero no explotado contra datos reales.
  - **Guard "destino ya completado debe bloquearse"**: confirmado por diseño de UI — el botón
    "Reasignar" directamente no aparece en cut_orders con estado `Completada` (columna
    Acciones muestra solo el texto "Completado"), así que no hay ruta de UI para intentar
    reasignar hacia un destino terminado. No se probó el bypass de servidor.
  - **Guard "sobre-corte" (hueco #1)**: confirmado por diseño de UI — una vez un cut_order
    pasa a `Completada`, la tarjeta en planta ya no muestra el stepper de cantidad ni el botón
    de confirmar recogida, sin ninguna forma de iniciar un corte adicional desde la interfaz
    normal. Sigue sin guard de servidor (`app/actions/cut-operations.ts:124-146`), pero no es
    explotable por un operario real a través de la UI tal como está hoy.
  - **Reasignación entre pedidos**: funcionó de punta a punta (2 unidades de `100042951` →
    `100042952`, confirmación de recogida desde planta, PREP real enviado a EVO). El botón
    vive en el cut_order DESTINO, no en el origen (ver nota corregida en el procedimiento
    arriba). Efecto correcto observado: al perder 2 unidades cortadas, `100042951` volvió
    automáticamente de `Finalizado` a `En Corte` (`updateOrderStatus` recalcula bien tras una
    reasignación saliente).
  - **Simulación del webhook `pedido_entregado`**: funcionó correctamente para `100042954`
    (entrega completa, `status → entregado`, `stock_reservado` liberado exactamente en la
    proporción esperada, evento registrado en `evo_events` con `success: true`). **Hallazgo
    nuevo: el webhook de entrega NO escribe en `delivery_history`** (esa tabla solo se llena
    desde el flujo manual `markOrderAsDelivered`, que no tiene botón en la UI) — esto deja sin
    auditoría historial el camino real de entrega (el que de verdad se usa en producción vía
    EVO). Añadido como hueco #13 más abajo.
  - Verificado visualmente en el admin: los 3 pedidos reflejan el estado correcto al final
    (`100042954` → Entregado, `100042952` → Finalizado, `100042951` → En Corte).

13. **El webhook `pedido_entregado` no registra nada en `delivery_history`**
    (`app/api/webhooks/pedidos/entregado/route.ts`, rama de entrega completa) — solo
    `markOrderAsDelivered` (`app/actions/orders.ts:727-735`, sin botón en UI) lo hace. El
    camino de entrega real (vía EVO) queda sin ese registro de auditoría aunque sí actualiza
    `orders.status` y `orders.delivered_at` correctamente.
