import subprocess
import sys
import time

# Start the process
proc = subprocess.Popen(
    ['npx', 'drizzle-kit', 'push', '--force'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1
)

# Send newlines continuously
try:
    for i in range(50):
        proc.stdin.write('\n')
        proc.stdin.flush()
        time.sleep(0.1)
    proc.stdin.close()
except:
    pass

# Print output
for line in proc.stdout:
    print(line, end='')

proc.wait()
sys.exit(proc.returncode)
