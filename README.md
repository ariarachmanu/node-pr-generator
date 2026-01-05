# PR Title & Description Generator

## 🤖 AI-Powered PR Generator

Tool otomatis untuk generate Pull Request title dan description menggunakan **Google AI Gemini API**. Tool ini menganalisis git diff Anda dan menghasilkan PR description yang relevan dan profesional.

### ✨ Features

- ✅ **Zero Dependencies** - Hanya menggunakan native Node.js modules
- ✅ **Cloud-based** - Tidak perlu install atau setup Docker
- ✅ **Super Fast** - Menggunakan Gemini 1.5 Flash untuk response cepat
- ✅ **FREE** - Google AI Gemini API memiliki free tier yang generous
- ✅ **Automatic** - Generate PR template dari staged changes
- ✅ **Conventional Commits** - Format title mengikuti conventional commits

---

## 📋 Prerequisites

- Node.js (v12 atau lebih baru)
- Git repository
- Google AI API Key (gratis di [Google AI Studio](https://aistudio.google.com/app/apikey))

---

## 🚀 Quick Start

### 1. Clone atau Download Project

```bash
git clone <repository-url>
cd pr-generator
```

### 2. Get Google AI API Key

1. Kunjungi [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Login dengan Google account
3. Klik "Create API Key"
4. Copy API key Anda

### 3. Set Environment Variable

**macOS/Linux:**
```bash
export GOOGLE_AI_API_KEY=your_api_key_here
```

**Windows (PowerShell):**
```powershell
$env:GOOGLE_AI_API_KEY="your_api_key_here"
```

**Permanent Setup (Recommended):**

Tambahkan ke `~/.bashrc`, `~/.zshrc`, atau `~/.profile`:
```bash
export GOOGLE_AI_API_KEY=your_api_key_here
```

Atau gunakan file `.env` (lihat `.env.example`):
```bash
cp .env.example .env
# Edit .env dan masukkan API key Anda
```

### 4. Make Script Executable (Optional)

```bash
chmod +x generate-pr.js
```

### 5. Test It!

```bash
# Stage some changes
git add .

# Run the script
node generate-pr.js
# atau jika sudah executable:
./generate-pr.js
```

---

## 📖 Usage

### Basic Usage

```bash
# 1. Stage your changes
git add .

# 2. Run the generator
node generate-pr.js

# 3. Review generated PR_TEMPLATE.md
cat PR_TEMPLATE.md
```

### Workflow Example

```bash
# Work on your feature
git checkout -b feature/new-authentication
# ... make changes ...

# Stage changes
git add .

# Generate PR template
node generate-pr.js

# Review and edit PR_TEMPLATE.md if needed
# Then create PR on GitHub/GitLab using the template
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_AI_API_KEY` | Your Google AI Gemini API key | Yes |

### Model Configuration

Default model: `gemini-1.5-flash` (fast and free)

Untuk mengubah model, edit `generate-pr.js`:

```javascript
const MODEL_NAME = 'gemini-1.5-pro'; // More powerful but slower
```

**Available Models:**
- `gemini-1.5-flash` - Fast, free tier (default)
- `gemini-1.5-pro` - More powerful, better quality
- `gemini-pro` - Previous generation

---

## 📝 Output

Script akan menghasilkan file `PR_TEMPLATE.md` dengan struktur:

```markdown
# [Generated Title]

## Description
[Generated detailed description]

## Branch
`your-branch-name`

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests passing
```

---

## 🔧 Advanced Usage

### Pre-commit Hook

Tambahkan ke `.git/hooks/pre-commit` atau `.husky/pre-commit`:

```bash
#!/usr/bin/env sh

# Check if there are staged changes
if ! git diff --cached --quiet; then
    echo "📝 Generating PR template..."
    
    if node generate-pr.js; then
        echo "✅ PR template generated: PR_TEMPLATE.md"
    else
        echo "⚠️  Failed to generate PR template"
    fi
fi
```

### Customize Prompt

Edit fungsi `generatePRContent()` di `generate-pr.js` untuk customize prompt sesuai kebutuhan project Anda.

---

## 🐛 Troubleshooting

### ❌ "Please set GOOGLE_AI_API_KEY environment variable!"

**Solution:**
```bash
export GOOGLE_AI_API_KEY=your_key_here
```

Atau pastikan file `.env` ada dan berisi API key.

### ❌ "Invalid API key!"

**Solution:**
1. Pastikan API key benar
2. Cek di [Google AI Studio](https://aistudio.google.com/app/apikey) apakah API key masih aktif
3. Pastikan API key tidak ada spasi atau karakter tambahan

### ❌ "Rate limit exceeded"

**Solution:**
- Google AI Gemini memiliki rate limit di free tier
- Tunggu beberapa saat dan coba lagi
- Atau upgrade ke paid tier untuk limit lebih tinggi

### ❌ "No staged changes found"

**Solution:**
```bash
git add .
# atau
git add <specific-files>
```

### ❌ "Not a git repository!"

**Solution:**
Pastikan Anda menjalankan script di dalam git repository:
```bash
git init  # jika belum ada
```

### ❌ "Could not parse JSON response"

**Solution:**
- Response dari AI mungkin tidak dalam format JSON yang valid
- Script akan fallback ke description default
- Coba lagi, atau edit `PR_TEMPLATE.md` manual

---

## 📊 API Limits & Pricing

### Free Tier (Gemini 1.5 Flash)
- **15 requests per minute (RPM)**
- **1,000 requests per day (RPD)**
- **1 million tokens per day**

### Paid Tier
- Higher rate limits
- More tokens per day
- Priority support

**Note:** Free tier biasanya cukup untuk penggunaan personal/small team.

---

## 🎯 Best Practices

1. **Review Generated Content** - Selalu review dan edit PR template sebelum submit
2. **Stage Relevant Changes** - Hanya stage perubahan yang relevan untuk PR
3. **Keep Commits Focused** - Generate PR untuk setiap logical change
4. **Customize for Your Team** - Edit prompt atau template sesuai standar team Anda

---

## 🔒 Security

- **Never commit API keys** - Gunakan environment variables atau `.env` file
- **Add `.env` to `.gitignore`** - Pastikan file `.env` tidak di-commit
- **Rotate API keys** - Jika API key ter-expose, generate yang baru

---

## 📚 Resources

- [Google AI Studio](https://aistudio.google.com/) - Get API key
- [Gemini API Documentation](https://ai.google.dev/docs) - Official documentation
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit message format

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

---

## 📄 License

This project is open source and available under the MIT License.

---

## ✅ Quick Checklist

- [ ] Node.js installed
- [ ] Google AI API key obtained
- [ ] `GOOGLE_AI_API_KEY` environment variable set
- [ ] Git repository initialized
- [ ] Script tested with `node generate-pr.js`
- [ ] `.env` file created (optional but recommended)
- [ ] `.gitignore` configured (if using `.env`)

---

## 🎉 Happy Coding!

Selamat menggunakan PR Generator! Semoga membantu workflow development Anda. 🚀
