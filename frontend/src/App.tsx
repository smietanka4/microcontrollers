import React, { useState, useEffect } from 'react'
import './App.css'

interface DeviceStatus {
  device?: string;
  error?: string;
}

interface SensorData {
  temperatureADC: number | never;
  lightADC: number | null;
  voltage: number | null;
  sw1: boolean | null;
  sw2: boolean | null;
}

function App() {
  const [deviceName, setDeviceName] = useState<string>('Brak połączenia')
  const [sensors, setSensors] = useState<SensorData>({
    temperatureADC: null,
    lightADC:null,
    voltage:null,
    sw1:null,
    sw2:null,
  })

  const [lcdMessage, setLcdMessage] = useState<string>('')
  const [lcdStatus, setLcdStatus] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const fetchAllData = async () => {
    try {
      const resTemp = await fetch('http://localhost:3000/api/measure/temperature').then(r => r.json());
      if (resTemp.error) throw new Error(resTemp.error);

      const resLight = await fetch('http://localhost:3000/api/measure/light').then(r => r.json());
      if (resLight.error) throw new Error(resLight.error);

      const resVolt = await fetch('http://localhost:3000/api/measure/voltage').then(r => r.json());
      if (resVolt.error) throw new Error(resVolt.error);
      
      const resSwitches = await fetch('http://localhost:3000/api/measure/switches').then(r => r.json());
      if (resSwitches.error) throw new Error(resSwitches.error);

      setSensors({
        temperatureADC: resTemp.temperatureADC,
        lightADC: resLight.lightADC,
        voltage: resVolt.voltage,
        sw1: resSwitches.sw1 === '1' || resSwitches.sw1_val === 1,
        sw2: resSwitches.sw2 === '1' || resSwitches.sw2_val === 1,
      })
    } catch (err) {
      console.error('Błąd pobierania danych z czujników: ', err)
    }
  }

  useEffect(() => {
    let isMounted = true;
    let timerId: ReturnType<typeof setTimeout>;

    const startPolling = async () => {
      try {
        const idnRes = await fetch('http://localhost:3000/api/idn').then(r => r.json());
        if (idnRes.device && isMounted) setDeviceName(idnRes.device);
      } catch (err) {
        if (isMounted) setDeviceName('Błąd połączenia z backendem');
      }

      const pollLoop = async () => {
        if (!isMounted) return;
        
        await fetchAllData(); 
        
        if (isMounted) {
          timerId = setTimeout(pollLoop, 2000); 
        }
      };

      pollLoop();
    };

    const initialBootDelay = setTimeout(() => {
      if (isMounted) startPolling();
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(timerId);
      clearTimeout(initialBootDelay);
    };
  }, []);

  const handleSendToLcd = async (e: React.SubmitEvent) => {
    e.preventDefault()
    if (!lcdMessage.trim()) return

    setIsLoading(true)
    setLcdStatus('Wysyłanie...')

    try {
      const response = await fetch('http://localhost:3000/api/config/lcd', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({message: lcdMessage})
      })
      const data = await response.json()
      if (data.status === 'OK') {
        setLcdStatus('Wysłano pomyślnie!')
        setLcdMessage('')
      } else {
        setLcdStatus('Błąd: ' + (data.error || "Nieznany"))
      }
    } catch (err) {
      setLcdStatus('Błąd sieci.')
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <div className='app-container'>
      <header className='app-header'>
        <h1>Panel</h1>
        <div className='status-badge'><strong>Status:</strong> {deviceName}</div>
      </header>

      <main className='sensor-grid'>
        <div className='sensor-card'>
          <h3>Temperatura</h3>
          <p className='sensor-value'>
            {sensors.temperatureADC !== null ? `${sensors.temperatureADC} ADC` : '---'}
          </p>
          <small className='scpi-subtext'>Komenda SCPI: MEAS:TEMP?</small>
        </div>

        <div className='sensor-card'>
          <h3>Oświetlenie</h3>
          <p className='sensor-value'>
            {sensors.lightADC !== null ? `${sensors.lightADC} ADC` : '---'}
          </p>
          <small className='scpi-subtext'>Komenda SCPI: MEAS:LIGH?</small>
        </div>

        <div className='sensor-card'>
          <h3>Potencjometr</h3>
          <p className='sensor-value'>
            {sensors.voltage !== null ? `${sensors.voltage.toFixed(2)} V` : '---'}
          </p>
          <small className='scpi-subtext'>Komenda SCPI: MEAS:VOLT?</small>
        </div>

        <div className='sensor-card'>
          <h3>Mikroprzełączniki</h3>
          <div className='switch-container'>
            <span className={sensors.sw1 ? "badge-active" : "badge-inactive"}>S1 (D3)</span>
            <span className={sensors.sw2 ? "badge-active" : "badge-inactive"}>S2 (D4)</span>
          </div>
          <small className='scpi-subtext'>Komenda SCPI: MEAS:SWIT?</small>
        </div>
      </main>

      <section className='lcd-section'>
        <h2>Sterowanie Wyświetlaczem LCD</h2>
        <form onSubmit={handleSendToLcd} className='lcd-form'>
          <input type='text' maxLength={16} value={lcdMessage} onChange={(e) => setLcdMessage(e.target.value)}
          placeholder='Wpisz komunikat do wysłania na LCD (max 16 znaków)' className='lcd-input' disabled={isLoading} />
          <button type='submit' className='lcd-button' disabled={isLoading || !lcdMessage.trim()}>
            Wyślij przez SCPI
          </button>
        </form>
        {lcdStatus && <p className='status-text'>{lcdStatus}</p>}
        <small className='scpi-subtext'>Komenda SCPI: CONF:LCD "tekst"</small>
      </section>
    </div>
  )
}

export default App
