import subprocess

def run_traceroute(command, destination, pre_args=None, post_args=None, timeout=550):
    cmd = [command]
    if pre_args: cmd.extend(pre_args)
    cmd.append(destination)
    if post_args: cmd.extend(post_args)
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=timeout
        )
        return result.stdout, None, result.returncode, cmd
    except FileNotFoundError:
        return "", f"Command not found: {command}", None, cmd
    except subprocess.TimeoutExpired as e:
        return (e.stdout or ""), f"Timeout>{timeout}s", None, cmd
    except Exception as e:
        return "", f"Execution error: {e}", None, cmd