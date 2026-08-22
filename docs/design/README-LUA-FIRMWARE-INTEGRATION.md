# Arquitectura de Integración de Firmware de Lúa (Mascota Periférica BLE)
## Plataformas VIA+ y Valeria+ · Dispositivo Médico SaMD Clase IIa / MDR 2017/745

---

## 1. Visión General y Propósito Clínico

**Lúa** es la compañera interactiva y biofeedback visual para las baterías clínicas de evaluación y rehabilitación del habla, audición y lenguaje en **VIA+** y **Valeria+**.

El periférico físico consiste en un dispositivo autónomo de bajo consumo equipado con:
* **Microcontrolador**: ESP32-C3 o ESP32-S3 con radio BLE 5.0.
* **Pantalla**: Display LCD circular IPS GC9A01 (240×240 píxeles, SPI a 40–80 MHz).
* **Alimentación**: Batería LiPo con gestor de carga TP4056/BQ24075 y monitor de tensión por ADC.

```
+-----------------------------------------------------------------------------+
|                                TABLETA (VIA+)                               |
|                                                                             |
|  [Audio Neuronal/TTS]  [DSP Acústico]  [Lógica Clínica / Evaluaciones]      |
|           |                 |                         |                     |
|           +-----------------+                         |                     |
|                   |                                   |                     |
|     (Mudez total durante pruebas)                     v                     |
|                                            [ useLuaCompanion.ts ]           |
|                                            [ luaAdapter.ts BLE ]            |
+-------------------------------------------------------+---------------------+
                                                        | BLE GATT (2.4 GHz)
                                                        | WriteWithoutResponse
                                                        v
+-----------------------------------------------------------------------------+
|                           PERIFÉRICO FÍSICO LÚA                             |
|                                                                             |
|  [ ESP32-C3 / S3 ] <---> [ NimBLE Server ]                                  |
|         |                     |                                             |
|         v                     v                                             |
|  [ Anillo LED/Ring ]   [ GC9A01 Circular SPI ]                              |
|   (12 niveles)          (24x24 px Pixel Art, 21 colores, 8 emociones)       |
+-----------------------------------------------------------------------------+
```

---

## 2. Perfil GATT y Servicios BLE

* **Service UUID**: `19B10000-E8F2-537E-4F6C-D104768A1214` (Servicio Principal Lúa)

### Características GATT

| Característica | UUID | Permisos / Tipo | Longitud | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **CTRL** | `19B10001-E8F2-537E-4F6C-D104768A1214` | Write / WriteWithoutResponse | 4 bytes | Comandos de control de estado, emoción, fase, veredicto, insignias y nivel. |
| **SAFE** | `19B10002-E8F2-537E-4F6C-D104768A1214` | Write / WriteWithResponse | 2 bytes | Comandos de seguridad crítica (concesión visual `GRANT`, parada de emergencia, silence). |
| **STATE** | `19B10003-E8F2-537E-4F6C-D104768A1214` | Read / Notify | 8 bytes | Telemetría del dispositivo (Batería %, Estado de pantalla, Latido, Concesión activa). |
| **CFG** | `19B10004-E8F2-537E-4F6C-D104768A1214` | Read / Write | 20 bytes | Configuración de brillo, orientación y timeout de reposo. |

---

## 3. Formato de Tramas y Tabla de Opcodes (`CTRL` / `SAFE`)

Cada trama de control enviada a la característica `CTRL` o `SAFE` se compone de **4 bytes**:
```
Byte 0: Opcode (uint8_t)
Byte 1: Param1 (uint8_t)
Byte 2: Param2 (uint8_t)
Byte 3: Checksum XOR o reservado (uint8_t = Byte0 ^ Byte1 ^ Byte2)
```

### Tabla Completa de Opcodes

| Opcode | Nombre | Param1 | Param2 | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **`0x01`** | `PHASE` | `phase_id` (0=intro, 1=test, 2=results) | `subphase` | Transición de fase clínica de la prueba activa. |
| **`0x02`** | `VERDICT` | `kind` (0=fallo/neutro, 1=ánimo, 2=éxito) | `streak` | Veredicto post-reactivo (Cero castigo: `kind=0` retorna a calma receptiva). |
| **`0x03`** | `CELEBRATE`| `intensity` (1=media, 2=estelar) | `duration_s` | Animación ceremonial de confeti/estrellas en pantalla circular. |
| **`0x04`** | `IDLE` | `mode` (0=reposo, 1=respiración) | `tempo_bpm` | Retorno al ciclo orgánico de respiración y parpadeo. |
| **`0x05`** | `CALL` | `variant` (0=saludo, 1=atención) | `0x00` | Llamada visual de atención al niño. |
| **`0x06`** | `AFFECT` | `emotion_id` (0–7) | `intensity` | Conmuta inmediatamente a una de las 8 emociones básicas. |
| **`0x07`** | `PICTO` | `picto_id` (0–255) | `frame` | Muestra un pictograma/estímulo 24×24 en el centro de la pantalla. |
| **`0x08`** | `AWARD` | `badge_id` (0–8) | `stars` (1–3) | Despliega y activa la insignia clínica otorgada. |
| **`0x09`** | `LEVEL` | `level` (1–12) | `0x00` | Actualiza el arco circular de progreso (1 a 12 segmentos activos). |
| **`0x10`** | `GRANT` | `ttl_seconds` (1–255) | `cap_mask` | **Seguridad**: Concede permiso de emisión (`0x00` = Solo visual). |
| **`0x11`** | `HEARTBEAT`| `seq_num` | `status` | Latido periódico cada 2000 ms desde la tableta. Si expira el TTL, Lúa se apaga. |

---

## 4. Matriz de Emociones (`AFFECT 0–7`)

Lúa implementa 8 estados afectivos canónicos basados en pixel art de 24×24 px con paleta indexada de 21 colores:

| ID | Emoción | Nombre Clínico | Ojos / Expresión | Color de Acento | Uso en Batería VIA+ |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **0** | `kExprJoy` | **Alegría** | Ojos cerrados curvados hacia arriba (`^^`) | Ámbar (`#F59E0B`) | Acierto en silbato, acierto en tarjeta verbal. |
| **1** | `kExprLove` | **Cariño** | Ojos tiernos con destello, cabeza ladeada | Rosa (`#F43F5E`) | Prosodia: escucha empática de la narración. |
| **2** | `kExprGratitude`| **Gratitud** | Inclinación suave y sonrisa acogedora | Azul Marino (`#0EA5E9`) | Bienvenida y cierre de sesión. |
| **3** | `kExprTranquility`| **Calma** | Ojos relajados, pulso de respiración lenta | Cian (`#06B6D4`) | Espera de estímulo, biofeedback diafragmático. |
| **4** | `kExprHope` | **Esperanza** | Ojos abiertos brillantes mirando arriba | Púrpura (`#A855F7`) | Cambio de norma DCCS, inicio de nivel difícil. |
| **5** | `kExprPride` | **Orgullo** | Mentón alto, pecho erguido, estrella | Esmeralda (`#10B981`) | Finalización de prueba e informes finales. |
| **6** | `kExprInspire`| **Inspiración** | Ojos firmes enfocados, postura activa | Índigo (`#6366F1`) | Sostén fonatorio de la `/a/` sostenida (5 s). |
| **7** | `kExprFun` | **Diversión** | Guiño cómplice y rebote juguetón | Naranja (`#FF7F00`) | Mini-juegos de funciones ejecutivas. |

---

## 5. Catálogo de Insignias Clínicas (`AWARD 0–8`)

| ID | Clave | Nombre de la Insignia | Módulo Origen | Icono Display |
| :---: | :--- | :--- | :--- | :---: |
| **0** | `oido_atento` | **Oído Atento** | Audiometría Condicionada | 🚂 Tren / Silbato |
| **1** | `palabras_claras` | **Palabras Claras** | Audiometría Verbal | 👂 Oreja / Tarjeta |
| **2** | `voz_sonora` | **Voz Firme y Sonora** | Análisis Acústico | 🎙️ Micrófono / Espectro |
| **3** | `ritmo_melodia` | **Ritmo y Melodía** | Prosodia | 🎵 Notas / Onda |
| **4** | `maestro_articular` | **Maestro Articulatorio** | Test T.A.R. | 🗣️ Perfil / SODA |
| **5** | `mente_agil` | **Mente Ágil** | Funciones Ejecutivas | 🧩 Puzzle / Cerebro |
| **6** | `deglucion_segura` | **Deglución Segura** | Disfagia MECV-V | 💧 Gota / Escudo |
| **7** | `sueno_reparador` | **Sueño Reparador** | Cribado SAHS | 🌙 Luna / Nube |
| **8** | `final_champion` | **Gran Campeón VIA+** | Informe Final Completo | 🏆 Copa / Gran Estrella |

---

## 6. Arquitectura de Firmware ESP32 (Ejemplo de Implementación C++)

```cpp
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <TFT_eSPI.h> // Driver GC9A01 240x240

// UUIDs
#define SERVICE_UUID        "19B10000-E8F2-537E-4F6C-D104768A1214"
#define CHAR_CTRL_UUID      "19B10001-E8F2-537E-4F6C-D104768A1214"
#define CHAR_SAFE_UUID      "19B10002-E8F2-537E-4F6C-D104768A1214"
#define CHAR_STATE_UUID     "19B10003-E8F2-537E-4F6C-D104768A1214"

TFT_eSPI tft = TFT_eSPI();

enum Opcode {
  OP_PHASE     = 0x01,
  OP_VERDICT   = 0x02,
  OP_CELEBRATE = 0x03,
  OP_IDLE      = 0x04,
  OP_CALL      = 0x05,
  OP_AFFECT    = 0x06,
  OP_PICTO     = 0x07,
  OP_AWARD     = 0x08,
  OP_LEVEL     = 0x09,
  OP_GRANT     = 0x10,
  OP_HEARTBEAT = 0x11
};

uint8_t current_emotion = 3; // Tranquility
uint8_t current_level = 1;
uint32_t last_heartbeat_ms = 0;
uint16_t grant_ttl_sec = 0;

void renderEmotion(uint8_t emotionId);
void renderProgressRing(uint8_t level);
void renderBadgeAward(uint8_t badgeId);

class ControlCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pCharacteristic) {
    std::string rx = pCharacteristic->getValue();
    if (rx.length() < 3) return;

    uint8_t op = rx[0];
    uint8_t p1 = rx[1];
    uint8_t p2 = rx[2];

    switch (op) {
      case OP_AFFECT:
        current_emotion = p1 % 8;
        renderEmotion(current_emotion);
        break;

      case OP_LEVEL:
        current_level = (p1 >= 1 && p1 <= 12) ? p1 : 1;
        renderProgressRing(current_level);
        break;

      case OP_AWARD:
        renderBadgeAward(p1);
        break;

      case OP_VERDICT:
        if (p1 == 2) {
          // Éxito: alegría temporal
          renderEmotion(0); // Joy
        } else {
          // Fallo/neutro: retorno sin castigo a tranquilidad
          renderEmotion(3); // Tranquility
        }
        break;

      case OP_GRANT:
        grant_ttl_sec = p1;
        // En VIA+ la capacidad de sonido física queda permanentemente anulada (MDR D-K)
        break;

      case OP_HEARTBEAT:
        last_heartbeat_ms = millis();
        break;

      default:
        break;
    }
  }
};

void setup() {
  Serial.begin(115200);
  tft.init();
  tft.setRotation(0);
  tft.fillScreen(TFT_BLACK);

  NimBLEDevice::init("LUA-COMPANION");
  NimBLEServer* pServer = NimBLEDevice::createServer();
  NimBLEService* pService = pServer->createService(SERVICE_UUID);

  NimBLECharacteristic* pCtrl = pService->createCharacteristic(
    CHAR_CTRL_UUID,
    NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
  );
  pCtrl->setCallbacks(new ControlCallbacks());

  pService->start();
  NimBLEAdvertising* pAdvertising = NimBLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->start();

  renderEmotion(current_emotion);
  renderProgressRing(current_level);
}

void loop() {
  // Liveness Check: apagar display si no hay latido en 5 segundos
  if (millis() - last_heartbeat_ms > 5000 && last_heartbeat_ms != 0) {
    tft.writecommand(0x10); // Display Sleep
  }
  delay(20);
}
```

---

## 7. Muro Regulatorio y Seguridad Médica (MDR 2017/745)

1. **Mudez Total Durante Pruebas Acústicas (Mandato D-K)**:
   El firmware de Lúa **tiene prohibido emitir cualquier pitido o sonido** durante las fases de audiometría, análisis acústico de voz, prosodia y articulación. Todo estímulo sonoro calibrado se origina exclusivamente en los altavoces de la tableta para no viciar las mediciones acústicas.
2. **Cero Texto en Periférico**:
   Para evitar sesgos cognitivos o requerimientos de lectoescritura en prelectores o niños con dificultades de lenguaje, la interfaz de Lúa es **100% iconográfica** mediante matrices de 24×24 px.
3. **Cero Castigo**:
   Los fallos en las pruebas nunca producen expresiones tristes, de enfado o punitivas; el periférico conmuta de inmediato a una postura de calma receptiva y escucha atenta (`kExprTranquility` o `kExprAttentive`).
4. **Desconexión Segura (`GRANT` Timeout)**:
   Si se pierde el enlace BLE con la tableta, Lúa entra en modo reposo orgánico de forma automática para evitar distracciones durante la consulta médica.
