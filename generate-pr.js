#!/usr/bin/env node
/**
 * PR Title & Description Generator using Google AI Gemini API
 * Cloud-based, FREE, and SUPER FAST!
 * No Docker needed!
 */

const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

/**
 * Load environment variables from .env file
 */
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    return {};
  }
  
  try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      // Remove comments and empty lines
      line = line.trim();
      if (!line || line.startsWith('#')) {
        return;
      }
      
      // Parse KEY=VALUE format
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        envVars[key] = value;
      }
    });
    
    return envVars;
  } catch (error) {
    console.log('⚠️  Warning: Could not read .env file:', error.message);
    return {};
  }
}

// Load .env file
const envVars = loadEnvFile();

// Configuration
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || envVars.GOOGLE_AI_API_KEY || 'YOUR_GOOGLE_AI_API_KEY_HERE';
// Try gemini-pro first (most stable), fallback to gemini-1.5-pro if needed
const MODEL_NAME = process.env.GEMINI_MODEL || envVars.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_OUTPUT_TOKENS = process.env.MAX_OUTPUT_TOKENS || envVars.MAX_OUTPUT_TOKENS || 4096;

/**
 * Get git diff of staged changes
 */
function getGitDiff() {
  try {
    const diff = execSync('git diff --cached', { encoding: 'utf-8' });
    
    if (!diff) {
      console.log('⚠️  No staged changes found. Use "git add" first.');
      process.exit(1);
    }
    
    return diff;
  } catch (error) {
    console.log('❌ Error getting git diff:', error.message);
    process.exit(1);
  }
}

/**
 * Get current branch name
 */
function getBranchName() {
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf-8' });
    return branch.trim();
  } catch (error) {
    return 'main';
  }
}

/**
 * Call Google AI Gemini API with specific model and version
 */
function callGeminiAPIWithModel(prompt, modelName, apiVersion = 'v1') {
  return new Promise((resolve, reject) => {
    // Remove only null bytes and problematic control characters, keep newlines
    const sanitizedPrompt = prompt
      .replace(/\0/g, '') // Remove null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control chars except \n, \t, \r
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: sanitizedPrompt
            }
          ]
        }
      ],
      generationConfig: {
      temperature: 0.7,
        maxOutputTokens: parseInt(MAX_OUTPUT_TOKENS) || 4096
      }
    };

    const data = JSON.stringify(requestBody);
    const dataBuffer = Buffer.from(data, 'utf-8');
    
    // URL encode API key for path
    const encodedApiKey = encodeURIComponent(GOOGLE_AI_API_KEY);
    const apiPath = `/${apiVersion}/models/${modelName}:generateContent?key=${encodedApiKey}`;

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: apiPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': dataBuffer.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`API error: ${res.statusCode} - ${responseData}`));
          return;
        }
        
        try {
          const result = JSON.parse(responseData);
          
          // Gemini API response structure
          if (result.candidates && result.candidates[0] && result.candidates[0].content) {
            const content = result.candidates[0].content.parts[0].text;
          resolve(content);
          } else {
            reject(new Error('Invalid API response structure'));
          }
        } catch (err) {
          reject(new Error('Failed to parse API response: ' + err.message));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(dataBuffer);
    req.end();
  });
}

/**
 * Call Google AI Gemini API with fallback models
 */
async function callGeminiAPI(prompt) {
  // List of models to try in order
  const modelsToTry = [
    { name: MODEL_NAME, version: 'v1beta' },
    { name: 'gemini-pro', version: 'v1' },
    { name: 'gemini-1.5-pro', version: 'v1beta' },
    { name: 'gemini-pro', version: 'v1beta' }
  ];

  let lastError = null;

  for (const { name, version } of modelsToTry) {
    try {
      console.log(`🔄 Trying model: ${name} (${version})...`);
      const result = await callGeminiAPIWithModel(prompt, name, version);
      console.log(`✅ Success with model: ${name}`);
      return result;
    } catch (error) {
      lastError = error;
      // If it's a 404, try next model
      if (error.message.includes('404') || error.message.includes('NOT_FOUND')) {
        continue;
      }
      // For other errors, throw immediately
      throw error;
    }
  }

  // If all models failed, throw the last error
  throw lastError || new Error('All model attempts failed');
}

/**
 * Sanitize text for safe JSON embedding
 */
function sanitizeForPrompt(text) {
  // Remove null bytes and control characters except newlines and tabs
  return text
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars except \n, \t, \r
    .substring(0, 3000); // Limit length
}

/**
 * Generate PR content using Google AI Gemini API
 */
async function generatePRContent(diff, branchName) {
  // Sanitize diff to prevent JSON issues
  const sanitizedDiff = sanitizeForPrompt(diff);
  
  const prompt = `Berdasarkan git diff berikut, buatkan judul dan deskripsi Pull Request dalam bahasa Indonesia.

Branch: ${branchName}

Git Diff:
${sanitizedDiff}

Harap berikan:
1. Judul PR yang ringkas (maksimal 72 karakter, mengikuti format conventional commits jika memungkinkan)
2. Deskripsi PR yang detail dalam bahasa Indonesia, termasuk:
   - Perubahan apa yang dilakukan
   - Mengapa perubahan ini dilakukan
   - Perubahan breaking atau catatan penting lainnya

Format respons Anda sebagai JSON:
{
  "title": "judul PR Anda di sini",
  "description": "deskripsi PR detail Anda di sini dalam bahasa Indonesia"
}

Hanya berikan JSON yang valid, tanpa teks tambahan.`;

  try {
    console.log('🤖 Generating PR content with Google AI Gemini API...');
    
    if (GOOGLE_AI_API_KEY === 'YOUR_GOOGLE_AI_API_KEY_HERE' || !GOOGLE_AI_API_KEY) {
      console.log('❌ Please set GOOGLE_AI_API_KEY!');
      console.log('   Get your free API key at: https://aistudio.google.com/app/apikey');
      console.log('');
      console.log('   Option 1: Set environment variable:');
      console.log('   export GOOGLE_AI_API_KEY=your_key_here');
      console.log('');
      console.log('   Option 2: Create .env file in project root:');
      console.log('   echo "GOOGLE_AI_API_KEY=your_key_here" > .env');
      process.exit(1);
    }
    
    const generatedText = await callGeminiAPI(prompt);
    
    // Debug: log raw response
    console.log('🔍 Raw API response preview:', generatedText.substring(0, 500));
    
    // Extract JSON from response - try multiple methods
    let prContent = null;
    
    // Step 1: Remove markdown code blocks first
    let cleanedText = generatedText
      .replace(/```json\s*/gi, '')  // Remove ```json (case insensitive)
      .replace(/```\s*/g, '')        // Remove ```
      .trim();
    
    // Step 2: Try regex extraction FIRST (more reliable for incomplete JSON)
    // This handles cases where JSON is cut off or description string is not closed
    
    // Extract title (should be complete)
    let titleMatch = cleanedText.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    
    // Extract description - handle incomplete JSON where quote might not be closed
    let descMatch = cleanedText.match(/"description"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/);
    
    // If description not found with closed quote, try without closing quote (incomplete JSON)
    if (!descMatch) {
      // Find "description" field and extract value even if quote is not closed
      const descStart = cleanedText.indexOf('"description"');
      if (descStart !== -1) {
        const afterDesc = cleanedText.substring(descStart);
        // Match "description": "value (without requiring closing quote)
        // Get everything after the opening quote until end of text
        const descValueMatch = afterDesc.match(/"description"\s*:\s*"([\s\S]*?)(?:"|$)/);
        if (descValueMatch) {
          let descValue = descValueMatch[1];
          // If the match ended because of end of string (not closing quote), we got incomplete value
          // That's okay, we'll use what we have
          descMatch = { 1: descValue };
          console.log('⚠️  Description string appears incomplete, extracting what we can');
        } else {
          // Even more lenient: just get everything after the colon and opening quote
          const descValueMatch2 = afterDesc.match(/"description"\s*:\s*"([\s\S]*)/);
          if (descValueMatch2) {
            descMatch = { 1: descValueMatch2[1] };
            console.log('⚠️  Description extracted from incomplete JSON (no closing quote found)');
          }
        }
      }
    }
    
    if (titleMatch || descMatch) {
      prContent = {
        title: titleMatch ? titleMatch[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim() : '',
        description: descMatch ? descMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim() : ''
      };
      console.log(`✅ Extracted via regex - Title: "${prContent.title}", Description: ${prContent.description ? 'present (' + prContent.description.length + ' chars)' : 'missing'}`);
    } else {
      // Fallback: Try to parse as complete JSON
      const startIdx = cleanedText.indexOf('{');
      const endIdx = cleanedText.lastIndexOf('}') + 1;
      
      if (startIdx !== -1 && endIdx > startIdx) {
        let jsonStr = cleanedText.substring(startIdx, endIdx);
        console.log('🔍 Trying to parse as complete JSON:', jsonStr.substring(0, 300));
        
        try {
          prContent = JSON.parse(jsonStr);
          console.log('✅ JSON parsed successfully');
          console.log('🔍 Parsed content:', JSON.stringify(prContent, null, 2));
        } catch (parseError) {
          console.log('⚠️  JSON parse also failed:', parseError.message);
        }
      }
    }
    
    // If we have parsed content, clean it up
    if (prContent) {
      // Clean up title - remove any markdown formatting or extra whitespace
      let cleanTitle = '';
      if (prContent.title) {
        cleanTitle = String(prContent.title)
          .replace(/^["']|["']$/g, '') // Remove surrounding quotes
          .replace(/\\n/g, ' ') // Convert \n to space in title
          .replace(/\\"/g, '"') // Unescape quotes
          .replace(/^\s*,\s*/, '') // Remove leading comma
          .trim();
      }
      
      // Clean up description - handle multi-line and escaped characters
      let cleanDescription = '';
      if (prContent.description) {
        cleanDescription = String(prContent.description)
          .replace(/^["']|["']$/g, '') // Remove surrounding quotes
          .replace(/\\n/g, '\n') // Convert \n to actual newlines
          .replace(/\\"/g, '"') // Unescape quotes
          .replace(/\\'/g, "'") // Unescape single quotes
          .replace(/\\t/g, '\t') // Convert \t to actual tabs
          .replace(/^\s*,\s*/, '') // Remove leading comma
          .replace(/^\s*description\s*:\s*/i, '') // Remove "description:" at start
          .trim();
        
        // Remove any remaining JSON structure if description still contains it
        if (cleanDescription.includes('"title"') || cleanDescription.includes('"description"') || cleanDescription.includes('description:')) {
          // Try to extract just the description text
          const descExtract = cleanDescription.match(/"description"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/);
          if (descExtract) {
            cleanDescription = descExtract[1]
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .trim();
          } else {
            // Remove entire JSON structure and artifacts
            cleanDescription = cleanDescription
              .replace(/\{[\s\S]*?"description"\s*:\s*"([^"]+)"[\s\S]*?\}/, '$1')
              .replace(/\{[\s\S]*?\}/g, '')
              .replace(/^\s*,\s*/, '') // Remove leading comma
              .replace(/^\s*description\s*:\s*/i, '') // Remove "description:"
              .trim();
          }
        }
      }
      
      // Only use fallback if title is truly empty or invalid
      if (!cleanTitle || cleanTitle.length === 0) {
        console.log('⚠️  Warning: Title is empty, using fallback');
        console.log('🔍 prContent.title value:', prContent.title);
        cleanTitle = 'Perbarui kode';
      } else {
        console.log(`✅ Title extracted successfully: "${cleanTitle}"`);
      }
      
      const result = {
        title: cleanTitle,
        description: cleanDescription || ''
      };
      
      console.log('🔍 Returning result:', JSON.stringify(result, null, 2));
      return result;
    }
    
    // Fallback if parsing failed
    console.log('⚠️  Tidak dapat memparse respons JSON, menggunakan fallback');
    return {
      title: 'Perbarui kode',
      description: generatedText.trim()
    };
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('403')) {
      console.log('❌ Invalid API key!');
      console.log('   Get your free API key at: https://aistudio.google.com/app/apikey');
    } else if (error.message.includes('429')) {
      console.log('❌ Rate limit exceeded. Please wait a moment and try again.');
    } else {
      console.log('❌ Error generating PR content:', error.message);
    }
    process.exit(1);
  }
}

/**
 * Extract issue code from branch name
 * Examples:
 *   AE-123-feature-a -> AE-123
 *   ae-123-feature-a -> AE-123 (converted to uppercase)
 *   OP-456-bugfix -> OP-456
 *   feature/test -> (empty, no code found)
 */
function extractIssueCodeFromBranch(branchName) {
  // Match pattern like AE-123, OP-456, ae-123, etc. (2-3 letters followed by dash and numbers)
  // Case insensitive, but convert to uppercase for consistency
  const match = branchName.match(/^([A-Za-z]{2,3}-\d+)/i);
  if (match) {
    // Convert to uppercase for consistency (AE-123, OP-456, etc.)
    return match[1].toUpperCase();
  }
  return '';
}

/**
 * Get system environment information
 */
function getEnvironmentInfo() {
  const os = require('os');
  const envInfo = {
    os: '',
    nodeVersion: process.version,
    tools: []
  };
  
  // Get OS information
  const platform = os.platform();
  const release = os.release();
  
  if (platform === 'darwin') {
    // macOS
    try {
      const macVersion = execSync('sw_vers -productVersion', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      envInfo.os = `macOS ${macVersion}`;
    } catch (e) {
      envInfo.os = `macOS ${release}`;
    }
  } else if (platform === 'linux') {
    // Linux - try to get distro name
    try {
      const distro = execSync('cat /etc/os-release 2>/dev/null | grep PRETTY_NAME', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
        .trim()
        .replace('PRETTY_NAME=', '')
        .replace(/"/g, '');
      envInfo.os = distro || `Linux ${release}`;
    } catch (e) {
      envInfo.os = `Linux ${release}`;
    }
  } else if (platform === 'win32') {
    // Windows
    try {
      const winVersion = execSync('ver', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      envInfo.os = `Windows ${winVersion}`;
    } catch (e) {
      envInfo.os = `Windows ${release}`;
    }
  } else {
    envInfo.os = `${platform} ${release}`;
  }
  
  // Detect tools/libraries
  // Check for Docker
  try {
    const dockerVersion = execSync('docker --version', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    envInfo.tools.push(dockerVersion);
  } catch (e) {
    // Docker not installed
  }
  
  // Check for npm
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    envInfo.tools.push(`npm ${npmVersion}`);
  } catch (e) {
    // npm not available
  }
  
  // Check for yarn
  try {
    const yarnVersion = execSync('yarn --version', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    envInfo.tools.push(`yarn ${yarnVersion}`);
  } catch (e) {
    // yarn not installed
  }
  
  // Check for Git
  try {
    const gitVersion = execSync('git --version', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    envInfo.tools.push(gitVersion);
  } catch (e) {
    // Git not available
  }
  
  return envInfo;
}

/**
 * Load GitHub PR template
 */
function loadGitHubPRTemplate() {
  const templatePath = path.join(process.cwd(), 'GITHUB_PR_TEMPLATE.MD');
  
  if (!fs.existsSync(templatePath)) {
    // Fallback to default template if file doesn't exist
    return null;
  }
  
  try {
    return fs.readFileSync(templatePath, 'utf-8');
  } catch (error) {
    console.log('⚠️  Warning: Could not read GITHUB_PR_TEMPLATE.MD:', error.message);
    return null;
  }
}

/**
 * Create PR template file using GITHUB_PR_TEMPLATE.MD format
 */
function createPRTemplate(title, description, branchName) {
  const issueCode = extractIssueCodeFromBranch(branchName);
  const githubTemplate = loadGitHubPRTemplate();
  
  let template;
  
  if (githubTemplate) {
    // Use GitHub template and fill in the content
    template = githubTemplate;
    
    // Clean description - aggressively remove any JSON structure
    let cleanDescription = String(description || '').trim();
    
    // Step 1: Remove JSON code blocks if present
    cleanDescription = cleanDescription
      .replace(/```json\s*/g, '')  // Remove ```json
      .replace(/```\s*/g, '')     // Remove ```
      .trim();
    
    // Step 2: If description contains JSON structure, extract just the text
    if (cleanDescription.includes('"description"') || cleanDescription.includes('"title"') || cleanDescription.includes('description:') || cleanDescription.startsWith('{')) {
      // Try multiple extraction methods
      
      // Method 1: Extract description value from JSON (handle escaped characters)
      const descMatch1 = cleanDescription.match(/"description"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/);
      if (descMatch1) {
        cleanDescription = descMatch1[1]
          .replace(/\\n/g, '\n')  // Convert \n to actual newlines
          .replace(/\\"/g, '"')   // Unescape quotes
          .replace(/\\'/g, "'")   // Unescape single quotes
          .replace(/\\\\/g, '\\') // Unescape backslashes
          .trim();
      } else {
        // Method 2: Try simpler extraction
        const descMatch2 = cleanDescription.match(/"description"\s*:\s*"([^"]+)"/);
        if (descMatch2) {
          cleanDescription = descMatch2[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .trim();
        } else {
          // Method 3: Remove entire JSON structure
          cleanDescription = cleanDescription
            .replace(/\{[\s\S]*?"description"\s*:\s*"([^"]+)"[\s\S]*?\}/, '$1')
            .replace(/\{[\s\S]*?\}/g, '') // Remove any remaining JSON objects
            .replace(/"title"\s*:\s*"[^"]*"/g, '') // Remove title field
            .replace(/"description"\s*:\s*"[^"]*"/g, '') // Remove description field
            .trim();
        }
      }
    }
    
    // Step 3: Remove JSON artifacts - koma, "description:", dll
    cleanDescription = cleanDescription
      .replace(/^\s*,\s*/gm, '') // Remove leading commas
      .replace(/^\s*description\s*:\s*/gmi, '') // Remove "description:" at start
      .replace(/^\s*"description"\s*:\s*/gmi, '') // Remove "description": at start
      .replace(/^\s*\{[\s\S]*?\}\s*$/m, '') // Remove standalone JSON objects
      .replace(/^[\s\n]*\{[\s\S]*?"description"[\s\S]*?\}[\s\n]*$/m, '') // Remove JSON with description
      .trim();
    
    // Step 4: Final check - remove any remaining JSON-like patterns
    if (cleanDescription.includes('{') || cleanDescription.includes('"title"') || cleanDescription.includes('"description"') || cleanDescription.match(/^\s*[,{]/)) {
      // Extract text between quotes if it's still JSON-like
      const textMatch = cleanDescription.match(/"description"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/);
      if (textMatch) {
        cleanDescription = textMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'")
          .trim();
      } else {
        // Last resort: remove everything that looks like JSON
        cleanDescription = cleanDescription
          .replace(/^\s*,\s*/gm, '') // Remove leading commas on each line
          .replace(/^\s*description\s*:\s*/gmi, '') // Remove "description:" 
          .replace(/\{[\s\S]*?\}/g, '') // Remove JSON objects
          .replace(/"title"\s*:\s*"[^"]*"/g, '') // Remove title field
          .replace(/"description"\s*:\s*"[^"]*"/g, '') // Remove description field
          .replace(/[{}"]/g, '') // Remove braces and quotes
          .replace(/^\s*,\s*/gm, '') // Remove any remaining leading commas
          .trim();
      }
    }
    
    // Step 5: Final cleanup - remove any leading/trailing commas or JSON artifacts
    cleanDescription = cleanDescription
      .replace(/^\s*,\s*/gm, '') // Remove leading commas
      .replace(/^\s*description\s*:\s*/gmi, '') // Remove "description:"
      .replace(/^\s*"description"\s*:\s*/gmi, '') // Remove "description":
      .trim();
    
    // Replace Deskripsi section with generated description
    // Match: ## Deskripsi\n\n[any content until next ## or end]
    template = template.replace(
      /(## Deskripsi\s*\n\s*\n)(.*?)(?=\n## |$)/s,
      `$1${cleanDescription}\n`
    );
    
    // Replace "Masalah yang Terkait" section with issue code
    if (issueCode) {
      // Replace the content after "Masalah yang Terkait" header
      template = template.replace(
        /(## Masalah yang Terkait\s*\n\s*\n)(.*?)(?=\n## |$)/s,
        `$1${issueCode}\n`
      );
    }
    // If no issue code found, keep the original placeholder text
    
    // Get environment information and fill "Lingkungan" section
    const envInfo = getEnvironmentInfo();
    const toolsList = envInfo.tools.length > 0 
      ? envInfo.tools.join(', ') 
      : 'Tidak ada tools khusus yang terdeteksi';
    
    // Replace "Lingkungan" section with environment info
    template = template.replace(
      /(## Lingkungan\s*\n\s*\nJelaskan lingkungan pengembangan yang digunakan untuk pengujian:\s*\n\s*\n)(.*?)(?=\n## |$)/s,
      `$1- OS: ${envInfo.os}
- Versi Node: ${envInfo.nodeVersion}
- Alat/Bibliotek: ${toolsList}
`
    );
    
    // Add title at the beginning (replace any existing title)
    // Remove any existing title at the start
    template = template.replace(/^#\s+.*?\n\n?/m, '');
    
    // Use the title as-is if it's provided and not empty
    // Only use fallback if title is truly missing
    const finalTitle = (title && title.trim() && title.trim().length > 0) ? title.trim() : 'Perbarui kode';
    template = `# ${finalTitle}\n\n${template}`;
    
    console.log(`📝 Title received: "${title}"`);
    console.log(`📝 Using title in template: "${finalTitle}"`);
  } else {
    // Get environment information for fallback template
    const envInfo = getEnvironmentInfo();
    const toolsList = envInfo.tools.length > 0 
      ? envInfo.tools.join(', ') 
      : 'Tidak ada tools khusus yang terdeteksi';
    
    // Fallback to default template if GITHUB_PR_TEMPLATE.MD not found
    template = `# ${title}

## Deskripsi
${description}

## Checklist

Pastikan poin-poin berikut diperiksa sebelum mengajukan pull request:

- [ ] Kode mengikuti pedoman gaya kode proyek ini.
- [ ] Saya telah melakukan self-review terhadap kode saya sendiri.
- [ ] Saya telah memberikan komentar pada kode saya, terutama di area yang sulit dipahami.
- [ ] Saya telah membuat perubahan yang sesuai pada dokumentasi.
- [ ] Perubahan saya tidak menghasilkan peringatan baru.
- [ ] Perubahan yang bergantung telah digabungkan dan dipublikasikan di modul hilir.

## Jenis Perubahan

Tandai kotak yang sesuai:

- [ ] Perbaikan bug (perubahan non-breaking yang memperbaiki masalah)
- [ ] Fitur baru (perubahan non-breaking yang menambahkan fungsionalitas)
- [ ] Perubahan breaking (perubahan yang memperbaiki atau menambahkan fitur yang menyebabkan perubahan API)
- [ ] Perbaikan dokumentasi

## Masalah yang Terkait
${issueCode || 'Masukan kode pada masalah terkait (misalnya, `OP#123`)'}

## Tes

Jelaskan bagaimana perubahan ini telah diuji dan referensikan instruksi pengujian yang relevan.
contoh jika ada testnya cara panggil testnya

## Lingkungan

- OS: ${envInfo.os}
- Versi Node: ${envInfo.nodeVersion}
- Alat/Bibliotek: ${toolsList}

## Screenshot (Opsional)

Jika ada perubahan UI, lampirkan screenshot untuk mendemonstrasikan perubahan.

## Catatan Tambahan

Tambahkan catatan tambahan atau informasi lain yang mungkin perlu diketahui oleh reviewer.
`;

    if (issueCode) {
      template += `\n## Related Issue\n\n\`${issueCode}\`\n`;
    }
  }

  fs.writeFileSync('PR_TEMPLATE.md', template);
  console.log('✅ PR template saved to: PR_TEMPLATE.md');
  
  if (issueCode) {
    console.log(`📌 Issue code extracted from branch: ${issueCode}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('🚀 PR Title & Description Generator (Google AI Gemini)');
  console.log('⚡ Super Fast & FREE!');
  console.log('='.repeat(60));
  
  // Check if we're in a git repository
  try {
    execSync('git status', { stdio: 'ignore' });
  } catch (error) {
    console.log('❌ Not a git repository!');
    process.exit(1);
  }
  
  // Get git information
  const branchName = getBranchName();
  console.log(`📝 Current branch: ${branchName}`);
  
  // Get git diff
  console.log('📊 Getting staged changes...');
  const diff = getGitDiff();
  
  const linesChanged = diff.split('\n').length;
  console.log(`📈 Lines in diff: ${linesChanged}`);
  
  // Generate PR content
  const prContent = await generatePRContent(diff, branchName);
  
  // Validate and clean title
  let finalTitle = prContent.title || 'Perbarui kode';
  if (finalTitle === 'Perbarui kode' || finalTitle.trim().length === 0) {
    console.log('⚠️  Warning: Title is empty or invalid');
  }
  finalTitle = finalTitle.trim();
  
  // Validate and clean description
  let finalDescription = prContent.description || '';
  finalDescription = finalDescription.trim();
  
  // Display results
  console.log('\n' + '='.repeat(60));
  console.log('✨ Generated PR Content:');
  console.log('='.repeat(60));
  console.log(`\n📌 TITLE:\n${finalTitle}\n`);
  console.log(`📄 DESCRIPTION:\n${finalDescription.substring(0, 200)}${finalDescription.length > 200 ? '...' : ''}\n`);
  
  // Save to file
  createPRTemplate(finalTitle, finalDescription, branchName);
  
  console.log('\n' + '='.repeat(60));
  console.log('💡 Next steps:');
  console.log('   1. Review the generated PR_TEMPLATE.md');
  console.log('   2. Edit if needed');
  console.log('   3. Use it when creating your PR on GitHub/GitLab');
  console.log('='.repeat(60));
}

// Run main function
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});