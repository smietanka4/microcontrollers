const express = require("express");
const cors = require("cors");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;

const arduinoPort = new SerialPort({
  path: "COM6",
  baudRate: 9600,
});

const parser = arduinoPort.pipe(new ReadlineParser({ delimiter: "\n" }));

let activeCommandResolve = null;

parser.on("data", (data) => {
  const cleanData = data.trim();
  console.log(`[Arduino -> PC]: ${cleanData}`);

  if (activeCommandResolve) {
    activeCommandResolve(cleanData);
    activeCommandResolve = null;
  }
});

const sendScpiCommand = (command) => {
  return new Promise((resolve, reject) => {
    if (activeCommandResolve) {
      return reject(
        new Error("Port szeregowy jest zajęty poprzednią operacją"),
      );
    }

    activeCommandResolve = resolve;
    console.log(`[PC -> Arduino]: ${command}`);
    arduinoPort.write(`${command}\n`);

    setTimeout(() => {
      if (activeCommandResolve === resolve) {
        activeCommandResolve = null;
        reject(new Error("Timeout: Arduino nie odpowiedziało w wymaganym czasie"))
      }
    }, 1500)
  });
};

// 1. Identyfikacja urządzenia (*IDN?)
app.get("/api/idn", async (req, res) => {
  try {
    const response = await sendScpiCommand("*IDN?");
    res.json({ device: response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Pomiar temperatury
app.get("/api/measure/temperature", async (req, res) => {
  try {
    const response = await sendScpiCommand("MEASure:TEMPerature?");
    res.json({ temperatureADC: parseInt(response) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Pomiar oświetlenia
app.get("/api/measure/light", async (req, res) => {
  try {
    const response = await sendScpiCommand("MEASure:LIGHt?");
    res.json({ lightADC: parseInt(response) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Pomiar napiecia na potencjometrze
app.get("/api/measure/voltage", async (req, res) => {
  try {
    const response = await sendScpiCommand("MEASure:VOLTage?");
    res.json({ voltage: parseFloat(response) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Odczyt stanu mikroprzełączników
app.get("/api/measure/switches", async (req, res) => {
  try {
    const response = await sendScpiCommand("MEASure:SWITches?");
    const [sw1, sw2] = response.split(",");
    res.json({
      sw1_val: sw1,
      sw2_val: sw2,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Konfiguracja wyświetlacza LCD (CONF)
app.post("/api/config/lcd", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res
        .status(400)
        .json({ error: 'Brak parametru "message" w body żądania' });
    }

    const response = await sendScpiCommand(`CONFigure:LCD "${message}"`);
    res.json({ status: response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na http://localhost:${PORT}`);
});
