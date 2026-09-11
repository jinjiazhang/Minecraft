"""Accept only exact script log requests, not player chat containing the marker."""
import json,re,subprocess
PATTERN=re.compile(r'^\[\d{4}-\d\d-\d\d \d\d:\d\d:\d\d:\d{3} WARN\] \[Scripting\] HELSINKI_RESET_REQUEST_V1\s*$')
def accepted(message):
    # journald encodes messages containing control bytes as a JSON byte array.
    if isinstance(message,list):
        if not all(type(v) is int and 0<=v<=255 for v in message):return False
        message=bytes(message).decode('utf-8',errors='replace')
    return isinstance(message,str) and PATTERN.fullmatch(message) is not None
def main():
    proc=subprocess.Popen(['journalctl','-u','bedrock.service','-n','0','-f','-o','json'],stdout=subprocess.PIPE,text=True)
    for line in proc.stdout:
        try:entry=json.loads(line)
        except ValueError:continue
        if accepted(entry.get('MESSAGE','')):
            result=subprocess.run(['python3','/opt/bedrock/official-admin/reset_world.py'])
            print('reset exit',result.returncode,flush=True)
if __name__=='__main__':main()
