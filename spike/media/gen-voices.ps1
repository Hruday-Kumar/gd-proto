# Generate the TTS voice clips the self-test bots "speak", using Windows'
# built-in SAPI speech engine (offline, free, no audio device needed — it
# writes straight to WAV files). Run from the spike/ folder: npm run gen-voices
$ErrorActionPreference = 'Stop'
$outDir = $PSScriptRoot

$clips = @(
  @{ File = 'alice.wav'; Text = 'I believe technology has completely transformed modern education for the better.' },
  @{ File = 'bob.wav';   Text = 'In my opinion, remote work gives employees far more flexibility and freedom.' },
  @{ File = 'carol.wav'; Text = 'Honestly, social media has a huge influence on how young people think today.' }
)

$voice  = New-Object -ComObject SAPI.SpVoice
$voices = $voice.GetVoices()
Write-Output "SAPI voices available: $($voices.Count)"

for ($i = 0; $i -lt $clips.Count; $i++) {
  $clip = $clips[$i]
  $path = Join-Path $outDir $clip.File

  $stream = New-Object -ComObject SAPI.SpFileStream
  $fmt = New-Object -ComObject SAPI.SpAudioFormat
  $fmt.Type = 22            # SAFT22kHz16BitMono (16-bit PCM mono)
  $stream.Format = $fmt
  $stream.Open($path, 3, $false)   # 3 = SSFMCreateForWrite

  $voice.AudioOutputStream = $stream
  if ($voices.Count -gt 1) { $voice.Voice = $voices.Item($i % $voices.Count) }
  [void]$voice.Speak($clip.Text, 0)   # 0 = synchronous
  $stream.Close()

  $size = (Get-Item $path).Length
  Write-Output "wrote $($clip.File) ($size bytes)"
}
