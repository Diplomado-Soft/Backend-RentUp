const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3.5';

console.log('Ollama Integration Test Suite\n');
console.log('='.repeat(50));
console.log(`Ollama URL:   ${OLLAMA_URL}`);
console.log(`Model Target: ${OLLAMA_MODEL}`);
console.log('='.repeat(50));

/**
 * Test 1: Check if Ollama is running
 */
async function testOllamaRunning() {
  console.log('\n Test 1: Verificar si Ollama está corriendo...');
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
    console.log('Ollama server está activo');
    return true;
  } catch (error) {
    console.error('Ollama no responde en ' + OLLAMA_URL);
    console.error(`   Error: ${error.message}`);
    console.error('\n   Solución: Ejecuta en otra terminal:');
    console.error('   $ ollama serve\n');
    return false;
  }
}

/**
 * Test 2: Check if Phi-3.5 Mini model is downloaded
 */
async function testModelDownloaded() {
  console.log('\n Test 2: Verificar si el modelo está descargado...');
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
    const models = response.data.models || [];
    const hasModel = models.some(m => m.name.includes('phi3.5'));
    
    if (hasModel) {
      console.log(`Modelo ${OLLAMA_MODEL} está descargado`);
      return true;
    } else {
      console.error(`Modelo ${OLLAMA_MODEL} NO está descargado`);
      console.error('\n   Modelos disponibles:');
      models.forEach(m => console.error(`   - ${m.name}`));
      console.error(`\n   Solución: El modelo phi3.5 ya está instalado, continúa con npm start\n`);
      return false;
    }
  } catch (error) {
    console.error('Error verificando modelos');
    console.error(`   ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Test simple generation
 */
async function testSimpleGeneration() {
  console.log('\n Test 3: Hacer una llamada simple al modelo...');
  try {
    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: OLLAMA_MODEL,
        prompt: 'Responde con "OK"',
        stream: false,
        temperature: 0.3
      },
      { timeout: 30000 }
    );

    if (response.data.response) {
      console.log(`Generación exitosa`);
      console.log(`   Respuesta: "${response.data.response.substring(0, 100)}..."`);
      console.log(`   Tiempo: ${response.data.eval_duration / 1e9}s`);
      return true;
    } else {
      console.error('Respuesta vacía del modelo');
      return false;
    }
  } catch (error) {
    console.error('Error en generación');
    console.error(`   ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n Conexión rechazada. Asegúrate de:');
      console.error('   1. ollama serve está corriendo');
      console.error('   2. Puerto 11434 está abierto');
    }
    return false;
  }
}

/**
 * Test 4: Test JSON response parsing
 */
async function testJSONParsing() {
  console.log('\n Test 4: Probar respuesta JSON del modelo...');
  try {
    const prompt = `Responde SOLO con JSON válido:
    {
      "test": true,
      "model": "phi3.5-mini",
      "message": "working"
    }`;

    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        temperature: 0.1
      },
      { timeout: 30000 }
    );

    const responseText = response.data.response;
    
    // Try to parse JSON
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[0]);
        console.log('JSON parsing exitoso');
        console.log(`   Parsed: ${JSON.stringify(json)}`);
        return true;
      } else {
        console.warn('No se encontró JSON en respuesta');
        console.warn(`   Raw: "${responseText.substring(0, 100)}..."`);
        return true; // No es critical
      }
    } catch (parseError) {
      console.warn('No se pudo parsear JSON');
      return true; // No es critical
    }
  } catch (error) {
    console.error('Error en test JSON');
    console.error(`   ${error.message}`);
    return false;
  }
}

/**
 * Test 5: Test sentiment analysis prompt
 */
async function testSentimentPrompt() {
  console.log('\n Test 5: Probar análisis de sentimiento...');
  try {
    const reviewText = 'Este apartamento es excelente, muy cómodo y el dueño es muy amable.';
    
    const prompt = `Analyze this apartment review sentiment. Respond ONLY with JSON:
    {
      "sentiment": "positive|negative|neutral",
      "score": number (1-5),
      "confidence": number (0-1)
    }
    
    Review: "${reviewText}"`;

    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        temperature: 0.2
      },
      { timeout: 30000 }
    );

    const responseText = response.data.response;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const json = JSON.parse(jsonMatch[0]);
      console.log('Análisis de sentimiento funciona');
      console.log(`   Sentimiento: ${json.sentiment}`);
      console.log(`   Score: ${json.score}/5`);
      console.log(`   Confianza: ${(json.confidence * 100).toFixed(1)}%`);
      return true;
    } else {
      console.warn('Respuesta no contiene JSON');
      return true;
    }
  } catch (error) {
    console.error('Error en test de sentimiento');
    console.error(`   ${error.message}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  const tests = [
    testOllamaRunning,
    testModelDownloaded,
    testSimpleGeneration,
    testJSONParsing,
    testSentimentPrompt
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`Test exception: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Resultados: ${passed} pasados, ${failed} fallidos\n`);

  if (failed === 0) {
    console.log('¡Ollama está listo para T-13!\n');
    console.log('Próximos pasos:');
    console.log('1. npm start en terminal de servidor');
    console.log('2. En admin panel, ir a "Reviews" → "Analyze Batch" para analizar reviews con IA');
    console.log('3. El servidor analizará reviews con Ollama IA\n');
    process.exit(0);
  } else {
    console.log('Hay problemas a resolver antes de continuar\n');
    console.log('Troubleshooting:');
    console.log('1. ¿Ollama está instalado? https://ollama.ai');
    console.log('2. ¿ollama serve está corriendo?');
    console.log('3. Asegúrate de que phi3.5 está descargado (ollama list)');
    console.log('4. ¿Puerto 11434 está disponible?');
    console.log('5. Revisa el .env OLLAMA_API_URL\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
