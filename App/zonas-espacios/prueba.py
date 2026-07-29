    for line in cmd.getLines():
        if line.find("HWaddr") != -1:
            macAddr = line.split("HWaddr ")[1].strip(" ")

        elif line.find("ether ") != -1:
            m = re.search(r"ether\s+([0-9a-f:]+)", line)
            if m is not None:
                macAddr = m.group(1)

        elif line.find("inet ") != -1:

            m = re.search(
                r"inet\s+([0-9\.]+)\s+netmask\s+([0-9\.]+)",
                line
            )

            if m is not None:
                ipAddr = m.group(1)
                netmask = m.group(2)

            else:
                m = re.search(
                    r"addr:([^\s]+)\s*Bcast:([^\s]+)\s*Mask:([^\s]+)",
                    line
                )

                if m is not None:
                    ipAddr = m.group(1).strip()
                    netmask = m.group(3).strip()