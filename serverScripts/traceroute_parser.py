import re

def parse_traceroute6(output):
    hops = []
    hop_line_pattern = re.compile(r'^\s*(\d+)\s+(.*)$')

    for line in output.splitlines():
        line = line.strip()
        if not line:
            continue

        # Skip the header line
        if line.startswith('traceroute to'):
            continue

        hop_match = hop_line_pattern.match(line)
        if not hop_match:
            continue

        hop_number = int(hop_match.group(1))
        rest_of_line = hop_match.group(2).strip()
        
        # Initialize variables
        ip = None
        hostname = None
        rtts = []
        
        # Split the line into tokens
        tokens = rest_of_line.split()
        
        i = 0
        while i < len(tokens):
            # Handle asterisks (timeouts)
            if tokens[i] == '*':
                rtts.append(None)
                i += 1
                continue
            
            # Handle RTT values: "number ms" (two separate tokens)
            if (i + 1 < len(tokens) and 
                tokens[i+1] == 'ms' and 
                tokens[i].replace('.', '', 1).isdigit()):
                try:
                    rtt_val = float(tokens[i])
                    rtts.append(rtt_val)
                except ValueError:
                    rtts.append(None)
                i += 2  # Skip both the number and "ms"
                continue
            
            # Handle RTT values (combined): "0.952ms"
            if tokens[i].endswith('ms'):
                try:
                    rtt_val = float(tokens[i].replace('ms', ''))
                    rtts.append(rtt_val)
                except ValueError:
                    rtts.append(None)
                i += 1
                continue
            
            # Handle hostname/IP combinations: "hostname (ip)" or "ip (ip)"
            if i + 1 < len(tokens) and tokens[i+1].startswith('(') and tokens[i+1].endswith(')'):
                potential_hostname = tokens[i]
                potential_ip = tokens[i+1].strip('()')
                
                # Only set hostname and IP if we haven't found them yet
                if ip is None:
                    ip = potential_ip
                    # Only set hostname if it's different from IP
                    if potential_hostname != potential_ip:
                        hostname = potential_hostname
                    else:
                        hostname = None
                
                i += 2
                continue
            
            # Handle standalone parenthesized IP: "(ip)"
            if tokens[i].startswith('(') and tokens[i].endswith(')'):
                potential_ip = tokens[i].strip('()')
                if ip is None:
                    ip = potential_ip
                    hostname = None
                
                i += 1
                continue
            
            # Handle bare hostnames/IPs (without parentheses)
            # This is a fallback for any remaining tokens that might be hostnames
            if (ip is None and 
                not tokens[i].endswith('ms') and 
                tokens[i] != '*' and 
                tokens[i] != 'ms' and
                not tokens[i].replace('.', '', 1).isdigit()):
                # Check if it looks like an IPv6 address
                if ':' in tokens[i]:
                    ip = tokens[i]
                    hostname = None
                else:
                    # Assume it's a hostname
                    hostname = tokens[i]
            
            i += 1
        
        # Ensure we have exactly 3 RTT values (pad with None if necessary)
        while len(rtts) < 3:
            rtts.append(None)
        
        # Limit to first 3 RTT values
        rtts = rtts[:3]
        
        hops.append({
            "hop": hop_number,
            "ip": ip,
            "hostname": hostname,
            "rtt_ms": rtts
        })

    return hops

