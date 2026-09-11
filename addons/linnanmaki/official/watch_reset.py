"""Accept only exact script log requests, not player chat containing the marker."""
import json,re,subprocess
PATTERN=re.compile(r'^\[\d{4}-\d\d-\d\d \d\d:\d\d:\d\d:\d{3} WARN\] \[Scripting\] HELSINKI_RESET_REQUEST_V1\s*$')
def accepted(message):return PATTERN.fullmatch(message) is not None
def main():
    proc=subprocess.Popen(['journalctl','-u','bedrock.service','-n','0','-f','-o','json'],stdout=subprocess.PIPE,text=True)
    for line in proc.stdout:
        try:entry=json.loads(line)
        except ValueError:continue
        if accepted(entry.get('MESSAGE','')):
            result=subprocess.run(['python3','/opt/bedrock/official-admin/reset_world.py'])
            print('reset exit',result.returncode,flush=True)
if __name__=='__main__':main()
