
var reg = process.binding("registry");
var vmx_detection = process.binding("vmx_detection");

function VmCheckGetDisksArray(path) {
    try {
        return new reg.WindowsRegistry(HKEY_LOCAL_MACHINE, path, KEY_READ, true).EnumKeys(path);
    } catch (e) {
        return [];
    }
}

function VmCheckVitrualDisks(array) {
    var vendors = [
        "VMware",
        "vbox",
        "SONI"
    ];

    for (let i = 0; i < array.length; i++) {
        for (let j = 0; j < vendors.length; j++) {
            if (array[i].toLowerCase().indexOf(vendors[j].toLowerCase()) !== -1) {
                return true;
            }
        }
    }

    return false;
}

function VmIsVirtualCPUPresent() {
    var goodIds = [
        "GenuineIntel",
        "AuthenticAMD",
        "AMDisbetter!"
    ];

    if (vmx_detection.isHypervisorPresent() === true) {
        return true;
    }

    return (goodIds.indexOf(vmx_detection.cpuId()) === -1)
}

function IsVirtualMachine() {

    

    var VMBioses = [
        "AMI ",
        "BOCHS",
        "VBOX",
        "QEMU",
        "SMCI",
        "INTEL  - 6040000",
        "FTNT-1",
        "SONI"
    ];

    var bIsVirtualMachine = false;
    var SystemBiosVersion =
        new reg.WindowsRegistry(HKEY_LOCAL_MACHINE, "HARDWARE\\DESCRIPTION\\System", KEY_READ, true)
            .ReadString("SystemBiosVersion").toString();

    

    for (let i = 0; i < VMBioses.length; i++) {
        if (SystemBiosVersion.toLowerCase().indexOf(VMBioses[i].toLowerCase()) !== -1) {
            bIsVirtualMachine = true;
            break;
        }
    }

    var ideDevices = VmCheckGetDisksArray('SYSTEM\\CurrentControlSet\\Enum\\IDE');
    var scsiDevices = VmCheckGetDisksArray('SYSTEM\\CurrentControlSet\\Enum\\SCSI');

    
    


    if (bIsVirtualMachine === false) {
        bIsVirtualMachine = (
            VmCheckVitrualDisks(ideDevices.keys) ||
            VmCheckVitrualDisks(scsiDevices.keys)
        );
    }

    if (bIsVirtualMachine === false) {
        bIsVirtualMachine = VmIsVirtualCPUPresent();
    }


    

    return bIsVirtualMachine;


    
}

exports.IsVirtualMachine = IsVirtualMachine;